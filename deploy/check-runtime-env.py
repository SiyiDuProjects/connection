import re,sys,pathlib,json
p=pathlib.Path(sys.argv[1])
if not p.is_file():
    print(json.dumps({'ready':False,'missingFile':str(p)}));sys.exit(1)
values={}
for line in p.read_text().splitlines():
    if not line.strip() or line.lstrip().startswith('#'):continue
    if '=' not in line:raise SystemExit('Invalid env-file line')
    key,value=line.split('=',1);values[key.strip()]=value.strip()
required=['POSTGRES_URL','AUTH_SECRET','BASE_URL','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET','RESEND_API_KEY','EMAIL_FROM','STRIPE_BASE_PRICE_ID','STRIPE_PLUS_PRICE_ID','TREG_TOKEN','OPENAI_API_KEY']
missing=[k for k in required if not values.get(k)]
invalid=[]
if len(values.get('AUTH_SECRET',''))<32:invalid.append('AUTH_SECRET')
for key in ['AUTH_SECRET','STRIPE_SECRET_KEY','STRIPE_WEBHOOK_SECRET']:
    if any(x in values.get(key,'').lower() for x in ['placeholder','fixture','validation','build-only']):invalid.append(key)
if values.get('BASE_URL')!='https://reachard.co':invalid.append('BASE_URL')
if values.get('CONTACT_PROVIDER')!='treg':invalid.append('CONTACT_PROVIDER')
if values.get('APOLLO_MOCK','false').lower()!='false':invalid.append('APOLLO_MOCK')
if values.get('BETA_UNLIMITED_USAGE','false').lower() not in ['0','false','no','off']:invalid.append('BETA_UNLIMITED_USAGE')
print(json.dumps({'ready':not(missing or invalid),'missingNames':missing,'invalidNames':sorted(set(invalid))}))
sys.exit(bool(missing or invalid))
