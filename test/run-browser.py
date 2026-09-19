"""Chromium tests. Normal mode uses the local demo server; --offline uses only
in-memory source and fixtures (no browser navigation or external network).
Requires: pip install playwright && playwright install chromium.
"""
import argparse
import json
import os
import re
import shutil
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--offline', action='store_true')
args = parser.parse_args()
base = os.environ.get('DEMO_URL', 'http://127.0.0.1:4317')
out = ROOT / 'test-artifacts'
out.mkdir(exist_ok=True)

def bindings(spec):
    return ', '.join(re.sub(r'\s+as\s+', ': ', v.strip()) for v in spec.split(',') if v.strip())

def local_module_bundle():
    # This is a test-only loader for this project's emitted ESM modules, not a production bundler.
    chunks = ['window.__modules = {};']
    for name in ['types', 'render', 'dom', 'heuristic', 'remote', 'index', 'jev']:
        source = (ROOT / 'dist' / f'{name}.js').read_text()
        exports = []
        for m in re.finditer(r'^export (?:async )?(?:function|class|const|let) (\w+)', source, re.M):
            exports.append(m.group(1))
        extra = []
        def reexport(m):
            spec, other = m.groups()
            extra.append(f'Object.assign(result, {{ {", ".join(f"{x.strip()}: window.__modules[{json.dumps(other)}].{x.strip()}" for x in spec.split(","))} }});')
            return ''
        source = re.sub(r'^export \{ ([^}]+) \} from [\'\"]\./([\w-]+)\.js[\'\"];?$', reexport, source, flags=re.M)
        def star(m):
            extra.append(f'Object.assign(result, window.__modules[{json.dumps(m.group(1))}]);')
            return ''
        source = re.sub(r'^export \* from [\'\"]\./([\w-]+)\.js[\'\"];?$', star, source, flags=re.M)
        source = re.sub(r'^import \{ ([^}]+) \} from [\'\"]\./([\w-]+)\.js[\'\"];?$', lambda m: f'const {{ {bindings(m.group(1))} }} = window.__modules[{json.dumps(m.group(2))}];', source, flags=re.M)
        source = re.sub(r'^export (?=(?:async )?(?:function|class|const|let) )', '', source, flags=re.M)
        source = re.sub(r'//# sourceMappingURL=.*', '', source)
        chunks.append(f'window.__modules[{json.dumps(name)}] = (() => {{\n{source}\nconst result = {{ {", ".join(exports)} }};\n' + '\n'.join(extra) + '\nreturn result; })();')
    return '\n'.join(chunks)

def prepare_offline(page, html_path):
    content = html_path.read_text()
    content = re.sub(r'<script\b[^>]*>.*?</script>', '', content, flags=re.S)
    content = re.sub(r'<link\b[^>]*>', '', content)
    page.set_content(content)
    page.evaluate(local_module_bundle())
    fixtures = {f'/fixtures/{name}.html': (ROOT / 'fixtures' / f'{name}.html').read_text() for name in ['article', 'documentation']}
    page.evaluate('''fixtures => {
      window.__fixtures = fixtures;
      window.fetch = async (url) => {
        if (String(url) === '/api/config') return new Response(JSON.stringify({hasApiKey:false, model:'jev-latest', sessionToken:'offline-test'}));
        if (Object.hasOwn(fixtures, String(url))) return new Response(fixtures[String(url)]);
        throw new Error('Offline test does not perform network requests: ' + url);
      };
    }''', fixtures)

def run_local_script(page, path):
    script = path.read_text()
    script = re.sub(r'^import \{ ([^}]+) \} from [\'\"]/dist/([\w-]+)\.js[\'\"];?$', lambda m: f'const {{ {bindings(m.group(1))} }} = window.__modules[{json.dumps(m.group(2))}];', script, flags=re.M)
    page.evaluate('(async () => {\n' + script + '\n})()')

with sync_playwright() as p:
    executable = os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    browser = p.chromium.launch(headless=True, executable_path=executable, args=['--no-sandbox'])
    page = browser.new_page()
    if args.offline:
        prepare_offline(page, ROOT / 'test' / 'browser.html')
        run_local_script(page, ROOT / 'test' / 'browser.mjs')
    else:
        page.goto(base + '/tests')
    page.wait_for_function('window.__TEST_RESULTS__ !== undefined')
    results = page.evaluate('window.__TEST_RESULTS__')
    results['execution'] = 'Chromium DOM, in-memory ESM test loader; fixture network mocked' if args.offline else 'Chromium, native ESM over local HTTP'
    (out / 'browser-results.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
    print(json.dumps(results, ensure_ascii=False, indent=2))
    # Verify visible UI behavior as a separate group, not model accuracy tests.
    ui = browser.new_page(viewport={'width': 1440, 'height': 1040}, device_scale_factor=1)
    errors = []
    ui.on('pageerror', lambda e: errors.append(str(e)))
    if args.offline:
        prepare_offline(ui, ROOT / 'examples' / 'index.html')
        ui.add_style_tag(content=(ROOT / 'examples' / 'styles.css').read_text())
        run_local_script(ui, ROOT / 'examples' / 'app.js')
    else:
        ui.goto(base)
    ui.wait_for_function('document.querySelector("#html").value.length > 0')
    checks = []
    def check(name, value):
        checks.append({'name': name, 'pass': bool(value)})
    check('source fixture loads', len(ui.locator('#html').input_value()) > 100)
    ui.locator('#extract').click()
    ui.wait_for_function('!document.querySelector("#output").hidden')
    check('article extraction is visible', '分类器只负责判断' in ui.locator('#output').inner_text())
    check('offline method is disclosed', '未调用 JEV' in ui.locator('#result-method').inner_text())
    ui.screenshot(path=str(out / 'preview-desktop.png'), full_page=True)
    # Save the full offline result as a reproducible example, separate from model predictions.
    ui.locator('[data-tab="json"]').click()
    (out / 'offline-example-result.json').write_text(ui.locator('#output').inner_text())
    ui.locator('[data-tab="markdown"]').click()
    check('Markdown tab includes code fences', '```typescript' in ui.locator('#output').inner_text())
    ui.locator('#engine').select_option('jev')
    ui.locator('#extract').click()
    ui.wait_for_function('!document.querySelector("#error").hidden')
    check('missing model key produces a clear error', 'TYPESAFE_API_KEY' in ui.locator('#error').inner_text())
    ui.locator('#engine').select_option('heuristic')
    ui.locator('#sample-doc').click()
    ui.wait_for_function('document.querySelector("#mode").value === "documentation"')
    ui.locator('#extract').click()
    ui.wait_for_function('document.querySelector("#output").textContent.includes("Extraction API")')
    check('documentation sample also runs', 'Reference links' in ui.locator('#output').inner_text())
    ui.set_viewport_size({'width': 390, 'height': 844})
    ui.screenshot(path=str(out / 'preview-mobile.png'), full_page=True)
    check('mobile viewport has no horizontal overflow', ui.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    check('UI has no unhandled JavaScript errors', not errors)
    summary = {'passed': sum(c['pass'] for c in checks), 'failed': sum(not c['pass'] for c in checks), 'tests': checks, 'pageErrors': errors, 'execution': results['execution']}
    (out / 'ui-results.json').write_text(json.dumps(summary, ensure_ascii=False, indent=2))
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    browser.close()
    raise SystemExit(1 if results['failed'] or summary['failed'] else 0)
