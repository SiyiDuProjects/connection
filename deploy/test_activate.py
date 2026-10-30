"""Exercise release ordering and rollback without Docker, credentials or a VPS."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parent
IMAGE = 'reachard:' + 'a' * 40
MOCK = '''#!/usr/bin/env python3
import json,os,sys
from pathlib import Path
p=Path(os.environ['MOCK_STATE']);s=json.loads(p.read_text());a=sys.argv[1:];name=Path(sys.argv[0]).name
s['calls'].append([name]+a)
code=0;out=''
if name=='docker':
 if a[:2]==['image','inspect']:out='[]'
 elif a and a[0]=='inspect':
  target=a[-1]
  if target=='reachard_candidate':code=1
  elif target=='reachard':
   if not s['unified']:code=1
   elif len(a)==2:out=json.dumps([{'Config':{'Env':['AUTH_SECRET=original-signing-secret','BASE_URL=https://reachard.co']}}])
   else:out='sha256:old-unified-image'
 elif a and a[0]=='compose':
  release=Path(a[a.index('--env-file')+1]).read_text()
  old='sha256:old-unified-image' in release
  if s['failure']=='compose' and not old:code=1
  else:s['new_active']=not old;s['unified']=True
 elif a[:3]==['rm','-f','reachard']:s['unified']=False;s['new_active']=False
elif name=='curl':
 url=a[-1]
 if ':18787' in url and s['failure']=='candidate':code=22
 elif ':8787' in url and s['new_active'] and s['failure']=='health':code=22
 else:out='{"ready":true}' if url.endswith('/health') else '<html>ok</html>'
p.write_text(json.dumps(s));print(out);sys.exit(code)
'''

class DeploymentTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        shutil.copytree(SOURCE, self.root/'deploy', ignore=shutil.ignore_patterns('__pycache__'))
        self.state = self.root/'state.json'
        self.bin = self.root/'bin'; self.bin.mkdir()
        for name in ['docker','curl','sleep']:
            p = self.bin/name; p.write_text(MOCK); p.chmod(0o755)
        values = dict(POSTGRES_URL='postgresql://test', AUTH_SECRET='x'*48, BASE_URL='https://reachard.co',
                      STRIPE_SECRET_KEY='sk_test_example', STRIPE_WEBHOOK_SECRET='whsec_example', RESEND_API_KEY='re_example',
                      EMAIL_FROM='Reachard <test@example.com>', STRIPE_BASE_PRICE_ID='price_base', STRIPE_PLUS_PRICE_ID='price_plus',
                      TREG_TOKEN='example', OPENAI_API_KEY='example', CONTACT_PROVIDER='treg')
        (self.root/'runtime.env').write_text(''.join(f'{k}={v}\n' for k,v in values.items()))

    def run_release(self, mode='activate', failure='', unified=True):
        self.state.write_text(json.dumps(dict(calls=[],failure=failure,unified=unified,new_active=False)))
        env = dict(os.environ, PATH=str(self.bin)+os.pathsep+os.environ['PATH'], MOCK_STATE=str(self.state),
                   REACHARD_RELEASE_ROOT=str(self.root))
        result = subprocess.run(['bash',str(self.root/'deploy/activate.sh'),IMAGE,mode],env=env,capture_output=True,text=True,timeout=30)
        return result, json.loads(self.state.read_text())

    def test_stage_never_stops_production(self):
        result,state=self.run_release('stage')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue(state['unified'])
        self.assertFalse(any(c[1] in ['stop','compose','update'] for c in state['calls'] if c[0]=='docker'))
        self.assertFalse((self.root/'backups').exists())

    def test_candidate_failure_keeps_production(self):
        result,state=self.run_release(failure='candidate')
        self.assertNotEqual(result.returncode,0)
        self.assertTrue(state['unified'])
        self.assertFalse(any(c[:2]==['docker','stop'] for c in state['calls']))

    def test_missing_configuration_never_touches_docker(self):
        (self.root/'runtime.env').unlink()
        result,state=self.run_release()
        self.assertNotEqual(result.returncode,0)
        self.assertEqual(state['calls'],[])

    def test_success_snapshots_release_and_only_touches_reachard(self):
        result,state=self.run_release()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertTrue(state['new_active'])
        self.assertEqual([c[-1] for c in state['calls'] if c[:2]==['docker','stop']],['reachard'])
        self.assertFalse(any(c[-1]=='down' for c in state['calls']))
        snapshot=Path((self.root/'last-rollback-path').read_text().strip())
        self.assertEqual(snapshot.stat().st_mode & 0o777,0o700)
        self.assertEqual((snapshot/'runtime.env').stat().st_mode & 0o777,0o600)

    def test_first_install_is_refused_without_a_recovery_target(self):
        result,state=self.run_release(unified=False)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse(state['new_active'])
        self.assertFalse(any(c[:2]==['docker','compose'] for c in state['calls']))

    def test_failed_upgrade_restores_running_environment_and_image(self):
        result,state=self.run_release(failure='health')
        self.assertNotEqual(result.returncode,0)
        self.assertTrue(state['unified'])
        self.assertFalse(state['new_active'])
        self.assertIn('sha256:old-unified-image',(self.root/'release.env').read_text())
        self.assertIn('AUTH_SECRET=original-signing-secret',(self.root/'runtime.env').read_text())
        self.assertNotIn('original-signing-secret',result.stdout+result.stderr)

if __name__ == '__main__': unittest.main()
