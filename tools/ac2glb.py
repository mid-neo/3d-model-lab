"""Minimal AC3D (.ac) -> glTF binary (.glb) converter.

Usage: python3 -I tools/ac2glb.py model.ac out.glb [--drop name,name] [--inspect]
Textures are resolved relative to the .ac file and embedded. Coordinates are
copied unchanged (no unit or axis conversion).
"""
import json, math, struct, sys, os
from collections import defaultdict

import numpy as np


def parse(path):
    lines = open(path, encoding='latin-1').read().splitlines()
    i = 0
    assert lines[0].startswith('AC3D')
    i = 1
    mats = []
    while lines[i].startswith('MATERIAL'):
        t = lines[i].split()
        def g(k, n):
            j = t.index(k)
            return [float(x) for x in t[j + 1:j + 1 + n]]
        mats.append({'rgb': g('rgb', 3), 'trans': g('trans', 1)[0], 'emis': g('emis', 3), 'name': lines[i].split('"')[1]})
        i += 1

    def read_obj():
        nonlocal i
        t = lines[i].split()
        assert t[0] == 'OBJECT', lines[i]
        o = {'type': t[1], 'name': '', 'texture': None, 'texrep': (1, 1), 'texoff': (0, 0),
             'rot': None, 'loc': (0, 0, 0), 'verts': [], 'surfs': [], 'kids': [], 'crease': 61.0}
        i += 1
        while True:
            t = lines[i].split()
            k = t[0] if t else ''
            if k == 'name':
                o['name'] = lines[i].split('"')[1] if '"' in lines[i] else t[1]; i += 1
            elif k == 'data':
                n = int(t[1]); i += 1
                consumed = 0
                while consumed < n:
                    consumed += len(lines[i]) + 1; i += 1
            elif k == 'texture':
                o['texture'] = lines[i].split('"')[1]; i += 1
            elif k == 'texrep':
                o['texrep'] = (float(t[1]), float(t[2])); i += 1
            elif k == 'texoff':
                o['texoff'] = (float(t[1]), float(t[2])); i += 1
            elif k == 'rot':
                o['rot'] = [float(x) for x in t[1:10]]; i += 1
            elif k == 'loc':
                o['loc'] = tuple(float(x) for x in t[1:4]); i += 1
            elif k == 'crease':
                o['crease'] = float(t[1]); i += 1
            elif k in ('url', 'subdiv', 'hidden', 'locked', 'folded'):
                i += 1
            elif k == 'numvert':
                n = int(t[1]); i += 1
                for _ in range(n):
                    o['verts'].append([float(x) for x in lines[i].split()[:3]]); i += 1
            elif k == 'numsurf':
                n = int(t[1]); i += 1
                for _ in range(n):
                    s = {'flags': 0, 'mat': 0, 'refs': []}
                    while True:
                        tt = lines[i].split()
                        if tt[0] == 'SURF':
                            s['flags'] = int(tt[1], 16); i += 1
                        elif tt[0] == 'mat':
                            s['mat'] = int(tt[1]); i += 1
                        elif tt[0] == 'refs':
                            m = int(tt[1]); i += 1
                            for _ in range(m):
                                r = lines[i].split(); i += 1
                                s['refs'].append((int(r[0]), float(r[1]), float(r[2])))
                            break
                        else:
                            raise ValueError('bad surf line %d: %r' % (i, lines[i]))
                    o['surfs'].append(s)
            elif k == 'kids':
                n = int(t[1]); i += 1
                for _ in range(n):
                    o['kids'].append(read_obj())
                return o
            else:
                raise ValueError('unknown line %d: %r' % (i, lines[i]))

    root = read_obj()
    return mats, root


def encode_texture(path, max_side=int(os.environ.get('TEX_MAX', '2048')), quality=85):
    """Re-encode opaque textures as JPEG (alpha textures stay PNG)."""
    import io
    from PIL import Image
    im = Image.open(path)
    if im.mode in ('RGBA', 'LA', 'P'):
        return open(path, 'rb').read(), 'image/png'
    im = im.convert('RGB')
    if max(im.size) > max_side:
        f = max_side / max(im.size)
        im = im.resize((round(im.size[0] * f), round(im.size[1] * f)), Image.LANCZOS)
    buf = io.BytesIO(); im.save(buf, 'JPEG', quality=quality, optimize=True)
    return buf.getvalue(), 'image/jpeg'


def triangulate(pts, n):
    """Ear-clip a planar-ish polygon; returns index triples into pts."""
    k = len(pts)
    if k <= 4:
        return [(0, a, a + 1) for a in range(1, k - 1)]
    ax = int(np.argmax(np.abs(n)))
    keep = [d for d in range(3) if d != ax]
    P = [np.array([p[keep[0]], p[keep[1]]]) for p in pts]
    sign = 1.0 if n[ax] > 0 else -1.0
    if ax == 1:
        sign = -sign  # dropping Y flips the handedness of the (x, z) projection
    def cross(o, a, b):
        return ((a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])) * sign
    idx = list(range(k)); tris = []; guard = 0
    while len(idx) > 3 and guard < 10000:
        guard += 1
        for j in range(len(idx)):
            i0, i1, i2 = idx[j - 1], idx[j], idx[(j + 1) % len(idx)]
            if cross(P[i0], P[i1], P[i2]) <= 0:
                continue
            if any(cross(P[i0], P[i1], P[q]) >= 0 and cross(P[i1], P[i2], P[q]) >= 0 and cross(P[i2], P[i0], P[q]) >= 0
                   for q in idx if q not in (i0, i1, i2)):
                continue
            tris.append((i0, i1, i2)); idx.pop(j); break
        else:
            break  # degenerate: fall back to fan for the rest
    if len(idx) >= 3:
        tris += [(idx[0], idx[a], idx[a + 1]) for a in range(1, len(idx) - 1)]
    return tris


def walk(o, parent_m, parent_t, drop, out, path=()):
    if o['name'] in drop:
        return
    r = np.array(o['rot'], float).reshape(3, 3) if o['rot'] else np.eye(3)
    m = parent_m @ r
    t = parent_m @ np.array(o['loc'], float) + parent_t
    if o['verts']:
        out.append((o, m, t, path + (o['name'],)))
    for k in o['kids']:
        walk(k, m, t, drop, out, path + (o['name'],))


def main():
    src, dst = sys.argv[1], sys.argv[2]
    drop = set()
    if '--drop' in sys.argv:
        drop = set(sys.argv[sys.argv.index('--drop') + 1].split(','))
    inspect = '--inspect' in sys.argv
    base = os.path.dirname(src)
    mats, root = parse(src)
    objs = []
    walk(root, np.eye(3), np.zeros(3), drop, objs)

    if inspect:
        for o, m, t, p in objs:
            used = sorted({s['mat'] for s in o['surfs']})
            print('%-32s v=%6d s=%6d mats=%s tex=%s' % ('/'.join(p[1:]), len(o['verts']), len(o['surfs']), used, o['texture']))
        return

    # Buckets keyed by (material index, texture, two-sided).
    buckets = defaultdict(lambda: {'pos': [], 'nrm': [], 'uv': []})
    for o, m, t, _ in objs:
        V = np.array(o['verts'], float) @ m.T + t
        cos_crease = math.cos(math.radians(o['crease']))
        faces = []
        for s in o['surfs']:
            kind = s['flags'] & 0xF
            if kind not in (0,) or len(s['refs']) < 3:
                continue  # lines and degenerate surfaces carry no area
            idx = [r[0] for r in s['refs']]
            # Newell normal handles non-planar polygons.
            n = np.zeros(3)
            for a in range(len(idx)):
                p0, p1 = V[idx[a]], V[idx[(a + 1) % len(idx)]]
                n += np.array([(p0[1] - p1[1]) * (p0[2] + p1[2]),
                               (p0[2] - p1[2]) * (p0[0] + p1[0]),
                               (p0[0] - p1[0]) * (p0[1] + p1[1])])
            ln = np.linalg.norm(n)
            if ln == 0:
                continue
            faces.append((s, n / ln))
        vert_faces = defaultdict(list)
        for fi, (s, n) in enumerate(faces):
            for r in s['refs']:
                vert_faces[r[0]].append(fi)
        for fi, (s, n) in enumerate(faces):
            smooth = bool(s['flags'] & 0x10)
            corner_n = []
            for r in s['refs']:
                if smooth:
                    acc = np.zeros(3)
                    for fj in vert_faces[r[0]]:
                        if np.dot(faces[fj][1], n) >= cos_crease:
                            acc += faces[fj][1]
                    acc /= np.linalg.norm(acc)
                    corner_n.append(acc)
                else:
                    corner_n.append(n)
            tex = o['texture']
            key = (s['mat'], tex, bool(s['flags'] & 0x20))
            b = buckets[key]
            rep, off = o['texrep'], o['texoff']
            refs = s['refs']
            for tri in triangulate([V[r[0]] for r in refs], n):
                for c in tri:
                    vi, u, v = refs[c]
                    b['pos'].append(V[vi]); b['nrm'].append(corner_n[c])
                    b['uv'].append((u * rep[0] + off[0], 1.0 - (v * rep[1] + off[1])))

    # Assemble glTF.
    bin_parts, views, accessors, meshes_prims, images, textures, materials = [], [], [], [], [], [], []
    offset = 0

    def add_view(data, target=None):
        nonlocal offset
        pad = (-len(data)) % 4
        bin_parts.append(data + b'\0' * pad)
        v = {'buffer': 0, 'byteOffset': offset, 'byteLength': len(data)}
        if target:
            v['target'] = target
        views.append(v)
        offset += len(data) + pad
        return len(views) - 1

    tex_index = {}
    for key in sorted(buckets, key=lambda k: (k[0], k[1] or '', k[2])):
        mi, tex, two = key
        b = buckets[key]
        pos = np.array(b['pos'], np.float32); nrm = np.array(b['nrm'], np.float32); uv = np.array(b['uv'], np.float32)
        # Weld identical corners so the mesh is indexed.
        cols = [pos, nrm] + ([uv] if tex else [])
        key_arr = np.round(np.hstack(cols), 5)
        _, first, inverse = np.unique(key_arr, axis=0, return_index=True, return_inverse=True)
        pos, nrm, uv = pos[first], nrm[first], uv[first]
        indices = inverse.reshape(-1).astype(np.uint32 if len(first) > 65535 else np.uint16)
        acc = {}
        for name, arr, typ in (('POSITION', pos, 'VEC3'), ('NORMAL', nrm, 'VEC3'), ('TEXCOORD_0', uv, 'VEC2')):
            if name == 'TEXCOORD_0' and not tex:
                continue
            a = {'bufferView': add_view(arr.tobytes(), 34962), 'componentType': 5126, 'count': len(arr), 'type': typ}
            if name == 'POSITION':
                a['min'] = pos.min(0).tolist(); a['max'] = pos.max(0).tolist()
            accessors.append(a); acc[name] = len(accessors) - 1
        accessors.append({'bufferView': add_view(indices.tobytes(), 34963),
                          'componentType': 5125 if indices.dtype == np.uint32 else 5123,
                          'count': len(indices), 'type': 'SCALAR'})
        index_acc = len(accessors) - 1
        mat = mats[mi]
        alpha = 1.0 - mat['trans']
        gm = {'name': (mat['name'] or 'mat%d' % mi) + ('+' + os.path.basename(tex) if tex else ''),
              'pbrMetallicRoughness': {'baseColorFactor': mat['rgb'] + [alpha], 'metallicFactor': 0.0, 'roughnessFactor': 0.6}}
        if any(mat['emis']):
            gm['emissiveFactor'] = mat['emis']
        if alpha < 0.999:
            gm['alphaMode'] = 'BLEND'
        if two:
            gm['doubleSided'] = True
        if tex:
            if tex not in tex_index:
                data, mime = encode_texture(os.path.join(base, tex))
                images.append({'bufferView': add_view(data), 'mimeType': mime, 'name': os.path.basename(tex)})
                textures.append({'source': len(images) - 1, 'sampler': 0})
                tex_index[tex] = len(textures) - 1
            gm['pbrMetallicRoughness']['baseColorTexture'] = {'index': tex_index[tex]}
        materials.append(gm)
        meshes_prims.append({'attributes': acc, 'indices': index_acc, 'material': len(materials) - 1})

    gltf = {
        'asset': {'version': '2.0', 'generator': 'ac2glb.py (3d-model-lab)'},
        'scene': 0, 'scenes': [{'nodes': [0]}],
        'nodes': [{'name': 'F-22', 'mesh': 0}],
        'meshes': [{'name': 'F-22', 'primitives': meshes_prims}],
        'accessors': accessors, 'bufferViews': views, 'materials': materials,
        'buffers': [{'byteLength': offset}],
    }
    if images:
        gltf['images'] = images; gltf['textures'] = textures
        gltf['samplers'] = [{'magFilter': 9729, 'minFilter': 9987, 'wrapS': 10497, 'wrapT': 10497}]
    extra = os.environ.get('GLTF_EXTRAS')
    if extra:
        gltf['asset']['extras'] = json.loads(extra)
    js = json.dumps(gltf, separators=(',', ':')).encode()
    js += b' ' * ((-len(js)) % 4)
    binb = b''.join(bin_parts)
    total = 12 + 8 + len(js) + 8 + len(binb)
    with open(dst, 'wb') as f:
        f.write(struct.pack('<III', 0x46546C67, 2, total))
        f.write(struct.pack('<II', len(js), 0x4E4F534A)); f.write(js)
        f.write(struct.pack('<II', len(binb), 0x004E4942)); f.write(binb)
    allpos = np.concatenate([np.array(buckets[k]['pos']) for k in buckets])
    print('triangles', len(allpos) // 3, 'min', allpos.min(0).round(3), 'max', allpos.max(0).round(3), 'size', (allpos.max(0) - allpos.min(0)).round(3))


if __name__ == '__main__':
    main()
