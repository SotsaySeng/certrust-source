import { sanitizeSvg } from '../svg-sanitize'

describe('sanitizeSvg', () => {
  const evil = `<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 10 10" onload="alert(1)">
<script>alert(2)</script><style>@import url(https://evil/x.css); .a{fill:url(https://evil/p);} .b{fill:#f00}</style>
<linearGradient id="gr"><stop offset="0" stop-color="#fff"/></linearGradient>
<path class="b" d="M0 0h10v10z" fill="url(#gr)" onclick="x()"/>
<a href="javascript:alert(3)"><rect width="5" height="5"/></a>
<foreignObject><div onmouseover="y()">hi</div></foreignObject>
<image href="https://evil/track.png" width="1" height="1"/>
<use xlink:href="#gr"/><image href="data:image/png;base64,iVBORw0KGgo=" width="1" height="1"/>
</svg>`
  const out = sanitizeSvg(evil)

  it('removes scripts, event handlers and javascript: links', () => {
    expect(out).not.toMatch(/<script|onload|onclick|onmouseover|javascript:/i)
    expect(out).not.toMatch(/<a[\s>]|foreignObject|<div/i)
  })

  it('removes external references (images, CSS imports and url())', () => {
    expect(out).not.toContain('https://evil')
    expect(out).not.toContain('@import')
  })

  it('keeps drawing content, internal references and inline raster images', () => {
    expect(out).toContain('<path class="b" d="M0 0h10v10z" fill="url(#gr)"')
    expect(out).toContain('xlink:href="#gr"')
    expect(out).toContain('href="data:image/png;base64,iVBORw0KGgo="')
    expect(out).toContain('viewBox="0 0 10 10"')
    expect(out).toContain('.b{fill:#f00}')
  })
})
