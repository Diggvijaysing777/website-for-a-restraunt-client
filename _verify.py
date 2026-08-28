#!/usr/bin/env python3
"""Build verification for the Hotel Grand Paragon Palace static site.
Scratch tool, not a deliverable. Run:  python3 _verify.py
"""
import os, re, sys, html as H

HERE = os.path.dirname(os.path.abspath(__file__))
def read(n): return open(os.path.join(HERE, n), encoding='utf-8').read()

doc, css, js = read('index.html'), read('style.css'), read('script.js')
# HTML with comments stripped, for checks that must not see documentation
body = re.sub(r'<!--.*?-->', '', doc, flags=re.S)

ok, bad = [], []
def check(name, cond, detail=''):
    (ok if cond else bad).append(name + (('  →  ' + str(detail)) if detail else ''))

def vid_src(src): return re.search(r'<video\b[^>]*>', src).group(0)

# ── assets ───────────────────────────────────────────────────────────────────
refs = set(re.findall(r'(?:src|href|poster)="([^"]+)"', body))
refs |= {u.strip().split()[0] for a in re.findall(r'srcset="([^"]+)"', body) for u in a.split(',')}
local = sorted(r for r in refs if r.startswith(('images/', 'media/')))
missing = [r for r in local if not os.path.exists(os.path.join(HERE, r))]
check('every local asset reference resolves on disk', not missing, missing)

on_disk = {os.path.join(d, f).replace(HERE + os.sep, '').replace(os.sep, '/')
           for d in (os.path.join(HERE, 'images'), os.path.join(HERE, 'media'))
           for f in os.listdir(d)}
orphans = sorted(on_disk - set(local))
check('no orphan files in images/ or media/', not orphans, orphans)

# ── low-quality placeholders ─────────────────────────────────────────────────
declared = set(re.findall(r'(--lq-[a-z0-9-]+):url\(', doc))
used     = set(re.findall(r'var\((--lq-[a-z0-9-]+)\)', body))
check('every --lq token is used', not declared - used, sorted(declared - used))
check('every --lq reference is declared', not used - declared, sorted(used - declared))

# ── no stock, no stale attributes ────────────────────────────────────────────
check('no unsplash / external image hosts', 'unsplash' not in doc.lower())
check('no stale data-local attributes', 'data-local' not in doc)

# ── the hard content rule: no prices anywhere ────────────────────────────────
money = re.findall(r'₹|\bRs\.?\s*\d|\bINR\b|\b3,?250\b|\b3,?750\b|\b4,?250\b', body)
check('no prices published anywhere', not money, money)
for word in ('complimentary breakfast', 'free breakfast'):
    check(f'does not advertise "{word}"', word not in body.lower())

# ── required verified figures ────────────────────────────────────────────────
figures = ['2002', '60,000', '24', '30', '100', '250', '1,000', '1,200', '8,500', '5,500']
absent = [f for f in figures if f not in body]
check('all verified figures present', not absent, absent)

# ── gallery ──────────────────────────────────────────────────────────────────
tiles = re.findall(r'<button[^>]*class="tile[^"]*"[^>]*data-cat="([^"]+)"', body)
check('gallery has one tile per supplied photograph (16)', len(tiles) == 16, len(tiles))
chips = set(re.findall(r'class="chip[^"]*"[^>]*data-filter="([^"]+)"', body)) - {'all'}
check('every chip matches at least one tile', not chips - set(tiles), sorted(chips - set(tiles)))
check('every tile category has a chip', not set(tiles) - chips, sorted(set(tiles) - chips))
check('all 16 tiles carry a stagger reveal',
      len(re.findall(r'class="tile reveal[^"]*"[^>]*data-reveal', body)) == 16)
check('exactly one chip starts pressed',
      body.count('class="chip is-on"') == 1
      and len(re.findall(r'class="chip[^"]*"[^>]*aria-pressed="true"', body)) == 1)
check('reel button static state is honest (paused, no autoplay)',
      'autoplay' not in vid_src(body) and 'id="reelBtn" aria-pressed="false"' in body
      and '<span id="reelState">Paused</span>' in body)
check('every chip exposes aria-pressed',
      len(re.findall(r'class="chip[^"]*"[^>]*aria-pressed=', body)) == len(chips) + 1)

# ── ids and anchors ──────────────────────────────────────────────────────────
ids = set(re.findall(r'\sid="([^"]+)"', body))
wanted = set(re.findall(r"""\$\(['"]#([A-Za-z0-9_-]+)['"]\)""", js))
wanted |= set(re.findall(r"""getElementById\(['"]([A-Za-z0-9_-]+)['"]\)""", js))
check('every id script.js looks up exists', not wanted - ids, sorted(wanted - ids))
anchors = {a[1:] for a in re.findall(r'href="(#[A-Za-z0-9_-]+)"', body)}
check('every in-page anchor resolves', not anchors - ids, sorted(anchors - ids))
dupes = [i for i in ids if body.count(f'id="{i}"') > 1]
check('no duplicate ids', not dupes, dupes)

# ── classes the new JS toggles must exist in CSS ──────────────────────────────
for cls in ('is-leaving', 'is-arm', 'is-arriving', 'is-hidden', 'lq', 'is-ready'):
    check(f'CSS defines .{cls}', f'.{cls}' in css)
check('.sheen element present in hero', 'class="sheen"' in body)
check('.sheen has CSS and a keyframe', '.sheen{' in css and '@keyframes sheen' in css)
check('scroll-driven hero exit is feature-gated',
      '@supports (animation-timeline:view())' in css)
check('scroll-driven hero exit respects reduced motion',
      re.search(r'@supports \(animation-timeline:view\(\)\)\{\s*@media \(prefers-reduced-motion:no-preference\)', css) is not None)
check('lightbox serves the widest srcset candidate, not the tile thumbnail',
      'function bestSrc' in js and 'currentSrc || img.src' in js and 'lbImg.src = img.currentSrc' not in js)
check('lightbox cross-fade has matching CSS', '.lightbox__fig img.is-swapping' in css)
check('lightbox warms its neighbours', 'warm(lbIndex + 1)' in js and 'warm(lbIndex - 1)' in js)
check('every tile srcset offers a larger candidate than the tile itself',
      all(len(a.split(',')) >= 2 for a in re.findall(r'class="tile[^"]*"[^>]*>\s*<img[^>]*srcset="([^"]+)"', body)))

# ── accessibility / semantics ────────────────────────────────────────────────
check('exactly one <h1>', body.count('<h1') == 1, body.count('<h1'))
imgs = re.findall(r'<img\b[^>]*>', body)
noalt = [i[:90] for i in imgs if 'alt=' not in i]
check('every <img> has an alt attribute', not noalt, noalt)
check('[hidden] guard present in CSS', re.search(r'\[hidden\]\{[^}]*display:none\s*!important', css) is not None)
vid = re.search(r'<video\b[^>]*>', body).group(0)
for attr in ('muted', 'playsinline', 'loop', 'poster'):
    check(f'reel video is {attr}', attr in vid)
check('reel video is not preloaded up front', 'preload="none"' in vid)

# ── syntax sanity ────────────────────────────────────────────────────────────
check('CSS braces balance', css.count('{') == css.count('}'), f"{css.count('{')}/{css.count('}')}")
check('HTML tags balance for structural elements',
      all(body.count(f'<{t}') == body.count(f'</{t}>') for t in ('section', 'article', 'figure', 'form')),
      {t: (body.count(f'<{t}'), body.count(f'</{t}>')) for t in ('section', 'article', 'figure', 'form')})
check('no leftover TODO markers', 'TODO' not in doc and 'TODO' not in css and 'TODO' not in js)
check('CONFIRM flags still documented', doc.count('CONFIRM:') >= 8, doc.count('CONFIRM:'))

print(f'\n\033[32mPASS {len(ok)}\033[0m   \033[31mFAIL {len(bad)}\033[0m\n')
for line in ok:  print('  \033[32m✓\033[0m', line)
for line in bad: print('  \033[31m✗\033[0m', line)
sys.exit(1 if bad else 0)
