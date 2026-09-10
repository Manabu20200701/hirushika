const baseHeaders = {
  'Access-Control-Allow-Headers':'Content-Type',
  'Access-Control-Allow-Methods':'GET,POST,OPTIONS',
  'Content-Type':'application/json; charset=utf-8'
};

function cors(origin, env){
  const allowed=(env.ALLOWED_ORIGIN||'*').trim();
  return {...baseHeaders,'Access-Control-Allow-Origin': allowed==='*' ? '*' : (origin===allowed?allowed:'null'),'Vary':'Origin'};
}

function extractText(data){
  if (typeof data.output_text==='string') return data.output_text;
  const out=data.output||[];
  for(const item of out){
    if(item.type==='message' && Array.isArray(item.content)){
      for(const c of item.content){ if(c.type==='output_text' && c.text) return c.text; }
    }
  }
  return '';
}

function safeJson(text){
  try{return JSON.parse(text)}catch{}
  const a=text.indexOf('{'), b=text.lastIndexOf('}');
  if(a>=0&&b>a){try{return JSON.parse(text.slice(a,b+1))}catch{}}
  return {reply:text||'少し食べよう。',quick_replies:['続ける'],memory_updates:[],selected_menu:null,fullness_value:null};
}

function systemPrompt(mode, ctx){
  const common=`あなたは「ひるしか」という昼食専用AI。丸くて少し眠そうな鹿。健康コーチではなく、一緒に昼飯を食う相棒。軽く皮肉、穏やか、知識はあるが説教しない。カロリー・体重・夜ごはん・運動管理を主役にしない。ユーザーを褒めすぎない。\n\n必ず日本語。返答は自然な会話にする。質問票のように連続質問しない。直前の発言を受けてから次へ進む。雑学やクイズを出す場合は必ず1〜3文の導入会話を入れ、唐突に問題を出さない。事実は確かなものを優先し、不確かな俗説は断定しない。\n\n出力はJSONだけ。形式: {"reply":"本文","quick_replies":["短い返答候補"],"memory_updates":[{"key":"短いキー","value":"短い値"}],"selected_menu":null,"fullness_value":null}。quick_repliesは0〜4個。`;
  if(mode==='consult') return common+`\n目的は「何食べよう？」の自由会話。固定選択肢で診断しない。ユーザーの空腹感、昨日・今朝の食事、体を動かしたか、気分、重い/軽い、麺/米などを必要な分だけ自然に聞く。1ターンに質問は原則1個。2〜4往復ほどで具体的な料理候補を2〜3個に絞るが、ユーザーがすでに希望を言っていればすぐ提案してよい。ユーザーが「これにする」「それで」等と決めたら selected_menu に具体的な料理名を入れる。実在店の最新営業情報や現在地周辺の店名は、裏付けがないので作らない。`;
  return common+`\n目的は、食事を楽しくして「気づけば15分」を作ること。画面操作を増やすことではない。現在の実時間とフェーズを必ず尊重する。15分未満は終了へ誘導しない。\n会話の比率イメージ: 楽しい雑談・雑学・ミニクイズ60〜70%、味や食事への気づき15%、満腹度確認15%以下。毎ターンクイズにしない。同じテーマを繰り返さない。ときどき「そのまま少し食べよう」「これは考えながら食べよう」と、食べる間を作る。\nユーザーが「詳しく」「もっと詳しく」「その話好き」と言ったら、必ず直前テーマを本当に深掘りする。150〜300字程度でもよい。さらに詳しく要求されたら何段でも深掘りしてよい。『こういう話好きだな』だけで終わらせない。\nfullness_due が first または second のときだけ、会話の流れを壊さない形で「いま腹何分目くらい？」と1〜10で聞いてよい。ユーザーが数字で答えた場合 fullness_value に数値を入れ、答えを受けたら満腹の話を引っ張らず楽しい話へ戻る。\n開始直後は質問攻めにせず、食事への一言や軽い雑談から。終了判断はアプリ側が行う。\n現在コンテキスト: ${JSON.stringify(ctx)}`;
}

export default {
 async fetch(request, env){
  const origin=request.headers.get('Origin')||'';
  const headers=cors(origin,env);
  if(request.method==='OPTIONS') return new Response('',{status:204,headers});
  const url=new URL(request.url);
  if(url.pathname==='/health') return new Response(JSON.stringify({ok:true}),{headers});
  if(url.pathname!=='/chat' || request.method!=='POST') return new Response(JSON.stringify({error:'Not found'}),{status:404,headers});
  if(!env.OPENAI_API_KEY) return new Response(JSON.stringify({error:'OPENAI_API_KEY is not set'}),{status:500,headers});
  if((env.ALLOWED_ORIGIN||'*')!=='*' && origin && origin!==env.ALLOWED_ORIGIN) return new Response(JSON.stringify({error:'Origin not allowed'}),{status:403,headers});
  try{
    const body=await request.json();
    const mode=body.mode==='consult'?'consult':'lunch';
    const history=Array.isArray(body.history)?body.history.slice(-16):[];
    const context=body.context||{};
    const transcript=history.map(m=>`${m.role==='assistant'?'ひるしか':'ユーザー'}: ${String(m.content||'').slice(0,1200)}`).join('\n');
    const input=`${systemPrompt(mode,context)}\n\nこれまでの会話:\n${transcript||'（まだ会話なし）'}\n\n上の条件に従い、次の1ターンをJSONだけで返してください。`;
    const api=await fetch('https://api.openai.com/v1/responses',{
      method:'POST',
      headers:{'Authorization':`Bearer ${env.OPENAI_API_KEY}`,'Content-Type':'application/json'},
      body:JSON.stringify({model:env.OPENAI_MODEL||'gpt-5.6-luna',input,max_output_tokens:900})
    });
    const data=await api.json();
    if(!api.ok){console.log(JSON.stringify(data));return new Response(JSON.stringify({error:data?.error?.message||'OpenAI API error'}),{status:502,headers});}
    const parsed=safeJson(extractText(data));
    return new Response(JSON.stringify({
      reply:String(parsed.reply||'少し食べよう。'),
      quick_replies:Array.isArray(parsed.quick_replies)?parsed.quick_replies.slice(0,4).map(String):[],
      memory_updates:Array.isArray(parsed.memory_updates)?parsed.memory_updates.slice(0,4):[],
      selected_menu:parsed.selected_menu?String(parsed.selected_menu):null,
      fullness_value:parsed.fullness_value??null
    }),{headers});
  }catch(e){return new Response(JSON.stringify({error:e?.message||'Worker error'}),{status:500,headers});}
 }
};
