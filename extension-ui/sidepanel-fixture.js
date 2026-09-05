
const scenario = new URLSearchParams(location.search).get('state');
const fixtureRole = scenario === 'neolix' ? {companyName:'Neolix',jobTitle:'Data Flywheel Engineer - Tech lead'} : {companyName:'OpenAI',jobTitle:'Software Engineer, Distributed Data Systems — Robotics'};
if (scenario === 'long-company') Object.assign(fixtureRole, {companyName:'Sandberg Goldberg Bernthal Family Foundation',jobTitle:'Back End Developer',jobSalary:'USD 130,000–200,000 / year',jobDatePosted:'2026-09-04T00:00:00.000Z'});
document.title = 'Reachard side panel · Local UI test';
if (scenario === 'compact-host') document.documentElement.style.fontSize = '10px';
const calls=[]; window.__fixtureCalls=calls;
let custom={tone:'warm',length:'concise',goal:'advice',notes:''};
const contact={id:'fixture-maya',name:'Maya Chen',title:'Engineering Manager',location:'San Francisco, CA',reasons:['Sample contact: leads a robotics engineering team.'],companyName:'OpenAI',linkedinUrl:'https://www.linkedin.com/in/reachard-ui-fixture/'};
if (scenario === 'long-contact') Object.assign(contact, {name:'Example Contact',title:'Member of "Conseil de Surveillance"',location:'Saint-Denis-le-Gast, Normandie, France',reasons:['Company match']});
if (scenario === 'long-company') Object.assign(contact, {name:'Stephanie Florence',title:'Interim Senior Manager, Girls Partnerships',location:'United States',companyName:fixtureRole.companyName,reasons:['Manager fit','Company match']});
const fixtureContacts = [contact,{...contact,id:'fixture-priya',name:'Priya Raman',title:'Technical Recruiter',reasons:['Sample contact: recruits for engineering roles.','Sample shared school connection.']}];
if (scenario === 'long-company') fixtureContacts.push(...Array.from({length:8},(_,index)=>({...contact,id:`fixture-extra-${index}`,name:`Sample Contact ${index + 3}`,title:'Software Engineer',reasons:['Engineering role match']})));
window.chrome={runtime:{id:'reachard-local-fixture',onMessage:{addListener(){},removeListener(){}},async sendMessage(message){
  calls.push({type:message.type,payload:message.payload});
  await new Promise(resolve=>setTimeout(resolve,180));
  if(message.type==='GET_REACHARD_EMBEDDED_CONTEXT')return{ok:true,tabId:10,pageContext:{type:'external_job',companyName:'OpenAI',jobTitle:'Software Engineer, Distributed Data Systems — Robotics',sourceUrl:'https://example.com/jobs/robotics'}};
  if(scenario==='signed-out')return{ok:false,status:401,error:'Sign in on the website.',action:{label:'Log In to Reachard',url:'https://reachard.co/dashboard'}};
  if(message.type==='GET_EMAIL_CUSTOMIZE')return{ok:true,custom};
  if(message.type==='SET_EMAIL_CUSTOMIZE'){if(scenario==='slow-save')await new Promise(resolve=>setTimeout(resolve,900));if(scenario==='save-error')return{ok:false,error:'Could not save your style. Try again.'};custom=message.payload;return{ok:true,custom};}
  if(message.type==='GET_ACCOUNT_STATUS')return{ok:true,account:{onboarding:{profile:{complete:true}},credits:{remaining:10}}};
  if(message.type==='CONTACTS_SEARCH'){await new Promise(resolve=>setTimeout(resolve,600));if(scenario==='error')return{ok:false,status:503,error:'Search is temporarily unavailable. Please try again.'};return{ok:true,contacts:scenario==='empty'?[]:fixtureContacts};}
  if(message.type==='CONTACTS_REVEAL')return{ok:true,email:'sample@example.com',credits:{remaining:9}};
  if(message.type==='EMAIL_DRAFT')return{ok:true,subject:'A question about robotics at OpenAI',body:'Hi '+message.payload.contact.name.split(' ')[0]+',\n\nI came across the robotics role at OpenAI. I’d love to hear about your experience on the team.\n\nThanks for considering it!\n[Your name]',mailtoUrl:'mailto:sample@example.com',personalizationNotes:['Current role','Saved '+custom.tone+' tone'],missingContext:[],warnings:['Local preview uses sample data.']};
  return{ok:false,error:'Unsupported fixture message'};
}},storage:{local:{get(key,callback){callback({})},set(){}}}};
const event = () => ({ addListener() {}, removeListener() {} });
chrome.runtime.getURL = path => new URL(path, location.href).href;
chrome.windows = { async getCurrent() { return { id: 1 }; } };
chrome.tabs = {
  onActivated: event(), onUpdated: event(), onRemoved: event(),
  async query() { return [{ id: 10, windowId: 1 }]; },
  async create({url}) { window.open(url, '_blank', 'noopener'); },
  async sendMessage() {
    return { ok: true, pageContext: scenario === 'no-context' ? null : {
      type: 'external_job', ...fixtureRole,
      sourceUrl: 'https://example.com/jobs/robotics',
      jobLocation: 'San Francisco, CA', jobDescription: 'Build data systems for robotics research.'
    } };
  }
};

chrome.sidePanel={close:async()=>{document.body.dataset.panelClosed='true';}};
