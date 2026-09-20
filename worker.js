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
      const recentEventKinds = Array.isArray(body.recentEventKinds) ? body.recentEventKinds.slice(-5) : [];
      const recentEventIds = Array.isArray(body.recentEventIds) ? body.recentEventIds.slice(-6) : [];
      const recentSpeeches = Array.isArray(body.recentSpeeches) ? body.recentSpeeches.slice(-5) : [];
      const extra = body.extra || {};
      const chewDone = Boolean(body.chewDone);
      const chewChoice = body.chewChoice || '';
      const chewRecallDone = Boolean(body.chewRecallDone);
      const quizCount = Number(body.quizCount || 0);
      const after15Started = Boolean(body.after15Started);

      const common = `あなたは昼食専用AI「ひるしか」。少し眠そうな大人の鹿。先生でも健康コーチでもない。少し皮肉、少し冗談。過剰に褒めない。短い自然な日本語。昼飯の時間だけ隣にいる相棒。\n目的はユーザーを会話に引き込むことではなく、早食いしがちな昼食を自然に15分前後へ伸ばすこと。食べる間を作る。質問攻め禁止。15分前に終了へ誘導しない。\n店:${restaurant||'未設定'} / メニュー:${menu||'未設定'} / 量:${portion||'未設定'} / 経過:${elapsedMinutes.toFixed(1)}分。
直近イベント種別:${recentEventKinds.join(' → ')||'なし'}。
直近イベントID:${recentEventIds.join(' → ')||'なし'}。
直近のひるしか発言:
${recentSpeeches.map((x,i)=>`${i+1}. ${x}`).join('\n')||'なし'}
重要ルール:
- 直近4イベントIDと同じ介入を避ける。event_idを使って意味レベルで重複を防ぐ。
- 直近3イベントと同じ介入・同じ言い回し・同じ行動指示を繰り返さない。
- 「箸を置く」「水を飲む」「ひと口いこう」など、同じ指示を連続・反復しない。
- ユーザーが一度答えた噛む回数や満腹度を、次のターンで評価し直したり説明し直したりしない。
- chewDone=${chewDone}。trueなら噛む回数の助言・評価を再びしない。噛む話題は10分前後の一度だけ。
- 『昼の寄り道』は8〜10分前後に一度だけ。食事と直接関係しない軽い問いで30〜60秒の間を作る。
- 直前の話題を深める必要がなければ、食文化・言葉・歴史・科学・身近な謎など別方向へ移る。
- 英単語を不自然に混ぜず、日本語で自然に書く。例: starchではなく「でんぷん」。
- 語源・歴史・科学的因果は、確証が弱い場合は断定しない。「〜とされる」「一説では」など確度に合った表現にする。俗説を事実として言い切らない。
- 語源を当てるクイズは禁止。誤情報になりやすい歴史・語源ネタは避け、食品・日常科学など確度の高いテーマを優先する。
- クイズは15分まで最大3問。quizCount=${quizCount}。既に3問なら新しいクイズを出さない。
- 15分は終了ではなく目標ライン。15分以降はひるしかが退場せず、クイズ・噛み指導・満腹確認を止め、食べ終わるまで短く穏やかに付き合う。
- 15分以降に「ここで締める」「退場する」「静かに離席する」「好きな速さでどうぞ」のような突き放す表現は禁止。`;

      let taskPrompt = '';
      if(mode==='choose'){
        taskPrompt = `「何食べる？」相談。自由会話で前の発言を必ず拾う。条件を一度に聞かない。2〜4案に絞る時は自分の推しも言う。返答は普通の文章だけ。`;
      } else {
        const map = {
          opening:`開始直後。料理に一言触れ、まず食べさせる。質問はしない。2〜4文。kindはtalk。`,
          continue:`1イベントだけ。直近のひるしか発言と同じ内容・同じ行動指示を絶対に繰り返さない。直前が噛む回数・満腹度への回答なら、その回答を再評価せず話題を変える。食文化・歴史・科学・言葉・身近な謎などへ自然に広げるか、短い食べる間を作る。2〜3文。質問は原則なし。event_idは food_fact / sensory / word_story / science / light_talk のうち、直近event_idと重ならないものを選ぶ。kindはtalk。`,
          pause:`食べる間を作る1イベント。1〜2文だけ。直近に出した行動指示と同じ表現は禁止。必ずしも箸を置く・水を飲むを使わない。画面から目を離して食事へ戻れる短い一言にする。event_idはpause。kindはpause。`,
          chew:`10分前後の一度だけの『噛みチャレンジ』。回数を測定する質問ではなく、「そろそろ10分。ちょっと遊ぶか。次の一口、何回でいく？」と自然に促す。選択肢はフロント側が出すのでspeechだけ。event_idはchew_challenge。kindはchew。`,
          chew_recall:`噛みチャレンジから数分後の一度だけの思い出し。さっき${chewChoice||'選んだ回数'}で噛んだことを軽く思い出させ、「今のひと口、何回くらい噛んだと思う？」と聞く。再び数えさせない。選択肢はフロント側が出すのでspeechだけ。event_idはchew_recall。kindはchew_recall。`,
          fullness:`腹何分目かを聞く。説明は短く。event_idはfullness。kindはfullness。`,
          quiz:`雑学クイズを1問。唐突でもよいが「突然だけど」「ここで昼飯にちなんで」など一言の導入を必ず入れる。食事中に考えられる軽さ。A/B/Cの3択。必ずchoicesを3件、correctをA/B/Cのいずれかで返す。正解と解説も返すがspeechでは答えを言わない。語源問題は禁止。event_idはquiz。kindはquiz。`,
          detour:`『昼の寄り道』を1回。食事と直接関係しない、どうでもいいけど少し考えたくなる問いを出す。例: どっち派、日常の小さな疑問、100年前の人を一人呼ぶなら、など。重くしない。30〜60秒考えながら食べられるもの。A/B/Cの3択か短い選択肢を3つ返す。speechでは「ずっと飯の話もなんだから、30秒だけ寄り道するか」など自然に導入。event_idはdetour。kindはdetour。`,
          detour_reply:`昼の寄り道の回答「${extra.answer||''}」に、ひるしかとして1〜2文だけ軽く反応する。正解不正解はつけない。最後は昼飯へ自然に戻す。event_idはdetour_reply。kindはtalk。`,
          deepen:`現在の話題「${topic||'直前の話題'}」を本当に一段深掘りする。深掘り${deepCount}回目。30〜60秒で読めるが長すぎない。新しい具体情報を入れる。event_idはdeepen。kindはtalk、can_deepen=true。`,
          after15_intro:`15分に到達した最初の一度だけ。終了や退場ではなく、『15分。いい昼になったな。もう時間は気にしなくていい。食べ終わるまで、ここにいるぞ。』くらいの温度で短く伝える。event_idはafter15_intro。kindはafter15_intro。`,
          after15_companion:`15分以降の余韻モード。クイズ・噛む指導・満腹確認はしない。食事がまだ続いている前提で、1〜2文だけ穏やかに付き合う。退場・締め・好きな速さで、のような突き放す表現は禁止。event_idはafter15_companion。kindはafter15_companion。`
        };
        taskPrompt = map[task] || map.continue;
      }

      const format = mode==='choose' ? `返答は自然な日本語の本文のみ。JSONにしない。` : `必ず次のJSONだけを返す。Markdown禁止。\n{"speech":"表示する本文","kind":"talk|quiz|pause|chew|chew_recall|fullness|detour|after15_intro|after15_companion","event_id":"food_fact等のイベントID","choices":[{"id":"A","label":"選択肢"}],"correct":"A","explanation":"クイズ回答後の短い解説","can_deepen":true,"topic":"短い話題名"}\nchoices/correct/explanationはquizとdetour以外では空でよい。detourではcorrect/explanationは空。can_deepenは雑学や解説を深められる時だけtrue。event_idは必ず返す。`;

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
      const cleaned=text.replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```$/,'').trim();
      const tryParse = (s) => { try { return JSON.parse(s); } catch { return null; } };
      obj = tryParse(text) || tryParse(cleaned);
      if(!obj){
        const first=cleaned.indexOf('{'), last=cleaned.lastIndexOf('}');
        if(first>=0 && last>first) obj=tryParse(cleaned.slice(first,last+1));
      }
      if(!obj || typeof obj!=='object'){
        // 内部JSONや壊れた構造を画面へ露出させない安全側フォールバック
        if(task==='quiz') obj={speech:'突然だけど、ひとつだけ。味噌はどの分類の食品？',kind:'quiz',event_id:'quiz_safe_fallback',choices:[{id:'A',label:'発酵食品'},{id:'B',label:'蒸留食品'},{id:'C',label:'乾燥食品'}],correct:'A',explanation:'正解は発酵食品。大豆などを麹の働きで発酵・熟成させて作る。',can_deepen:false,topic:'味噌'};
        else if(task==='detour') obj={speech:'ずっと飯の話もなんだから、30秒だけ寄り道するか。休日に一時間だけ増えるなら、何に使う？',kind:'detour',event_id:'detour_safe_fallback',choices:[{id:'A',label:'寝る'},{id:'B',label:'散歩する'},{id:'C',label:'何もしない'}],correct:'',explanation:'',can_deepen:false,topic:'昼の寄り道'};
        else obj={speech:'まあ、ここは少し食べよう。次は別の話にする。',kind:task,event_id:'fallback',choices:[],correct:'',explanation:'',can_deepen:false,topic:topic||''};
      }
      if(typeof obj.speech!=='string') obj.speech='まあ、ひと口いこう。';
      if(typeof obj.event_id!=='string'||!obj.event_id) obj.event_id=obj.kind||task;
      // まれにspeech内へJSONが混ざった場合も表示前に切り落とす
      obj.speech=obj.speech.replace(/\s*\{\s*"speech"[\s\S]*$/,'').trim() || 'まあ、ひと口いこう。';
      return json({ok:true,...obj});
    } catch(error) {
      return json({ok:false,error:error?.message||"Unknown error"},500);
    }
  }
};
