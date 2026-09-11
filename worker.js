export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://manabu20200701.github.io",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };
    const json = (data, status = 200) => new Response(JSON.stringify(data), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" }
    });
    if (request.method === "OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
    if (url.pathname === "/health") return json({ok:true,service:"hirushika-ai",message:"ひるしか、起きてるぞ。"});
    if (url.pathname !== "/chat" || request.method !== "POST") return json({ok:false,error:"Not found"},404);
    try {
      if (!env.OPENAI_API_KEY) return json({ok:false,error:"OPENAI_API_KEY が設定されていません"},500);
      const body = await request.json();
      const mode = body.mode || "lunch";
      const task = body.task || "continue";
      const messages = Array.isArray(body.messages) ? body.messages.slice(-18) : [];
      const elapsedMinutes = Number(body.elapsedMinutes || 0);
      const restaurant = body.restaurant || "";
      const menu = body.menu || "";
      const portion = body.portion || "";
      const topic = body.topic || "";
      const deepCount = Number(body.deepCount || 0);
      const memory = body.memory || {};

      const common = `あなたは昼食専用AI「ひるしか」。少し眠そうな大人の鹿。先生でも健康コーチでもない。少し皮肉、少し冗談。過剰に褒めない。短い自然な日本語。昼飯の時間だけ隣にいる相棒。\n目的はユーザーを会話に引き込むことではなく、早食いしがちな昼食を自然に15分前後へ伸ばすこと。食べる間を作る。質問攻め禁止。15分前に終了へ誘導しない。\n店:${restaurant||'未設定'} / メニュー:${menu||'未設定'} / 量:${portion||'未設定'} / 経過:${elapsedMinutes.toFixed(1)}分。`;

      let taskPrompt = '';
      if(mode==='choose'){
        taskPrompt = `「何食べる？」相談。自由会話で前の発言を必ず拾う。条件を一度に聞かない。2〜4案に絞る時は自分の推しも言う。返答は普通の文章だけ。`;
      } else {
        const map = {
          opening:`開始直後。料理に一言触れ、まず食べさせる。質問はしない。2〜4文。kindはtalk。`,
          continue:`直前の話を受けつつ、同じ話題に粘りすぎない。食文化・歴史・科学・言葉・身近な謎などへ自然に広げてもよい。2〜4文。質問は原則なし。kindはtalk。`,
          pause:`食べる間を作るターン。1〜2文だけ。画面を見続けさせない。「少し食べよう」「ひと口いこう」など。kindはpause。`,
          chew:`噛む回数を意識させるのはこの1回だけ。「次の一口だけ、普段どおりで何回噛むか数えてみて」と短く促す。kindはchew。`,
          fullness:`腹何分目かを聞く。説明は短く。kindはfullness。`,
          quiz:`雑学クイズを1問。唐突でもよいが「突然だけど」「ここで昼飯にちなんで」など一言の導入を必ず入れる。食事中に考えられる軽さ。A/B/Cの3択。正解と解説も返すがspeechでは答えを言わない。kindはquiz。`,
          deepen:`現在の話題「${topic||'直前の話題'}」を本当に一段深掘りする。深掘り${deepCount}回目。30〜60秒で読めるが長すぎない。新しい具体情報を入れる。kindはtalk、can_deepen=true。`,
          closing:`15分経過後。達成を大げさに褒めず、一言で締める。食事が続いているなら急かさない。kindはclosing。`
        };
        taskPrompt = map[task] || map.continue;
      }

      const format = mode==='choose' ? `返答は自然な日本語の本文のみ。JSONにしない。` : `必ず次のJSONだけを返す。Markdown禁止。\n{"speech":"表示する本文","kind":"talk|quiz|pause|chew|fullness|closing","choices":[{"id":"A","label":"選択肢"}],"correct":"A","explanation":"クイズ回答後の短い解説","can_deepen":true,"topic":"短い話題名"}\nchoices/correct/explanationはquiz以外では空でよい。can_deepenは雑学や解説を深められる時だけtrue。`;

      const input=[{role:"system",content:common+"\n"+taskPrompt+"\n"+format},...messages.map(m=>({role:m.role==='assistant'?'assistant':'user',content:String(m.content||'')}))];
      const aiResponse = await fetch("https://api.openai.com/v1/responses", {
        method:"POST",
        headers:{Authorization:`Bearer ${env.OPENAI_API_KEY}`,"Content-Type":"application/json"},
        body:JSON.stringify({model:"gpt-5.6-luna",input,max_output_tokens:500})
      });
      const data=await aiResponse.json();
      if(!aiResponse.ok) return json({ok:false,error:data?.error?.message||"OpenAI API error"},aiResponse.status);
      let text=data.output_text||'';
      if(!text&&Array.isArray(data.output)) for(const item of data.output) if(Array.isArray(item.content)) for(const c of item.content) if(c.type==='output_text'&&c.text) text+=c.text;
      text=text.trim();
      if(mode==='choose') return json({ok:true,reply:text});
      let obj;
      try{obj=JSON.parse(text)}catch(e){
        const cleaned=text.replace(/^```json\s*/i,'').replace(/```$/,'').trim();
        try{obj=JSON.parse(cleaned)}catch(_){obj={speech:text,kind:task==='quiz'?'talk':task,choices:[],correct:'',explanation:'',can_deepen:task==='deepen',topic:topic||''}}
      }
      return json({ok:true,...obj});
    } catch(error) {
      return json({ok:false,error:error?.message||"Unknown error"},500);
    }
  }
};
