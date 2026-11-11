/* Small arithmetic parser for money inputs. Never evaluates JavaScript. */
(function(root){
    function calculate(input){
        if(typeof input==='number'){if(Number.isFinite(input)&&Math.abs(input)<=Number.MAX_SAFE_INTEGER)return input;throw Error('金額超出範圍');}
        if(typeof input!=='string'||!input.trim())throw Error('請輸入金額');
        const source=input.replace(/[０-９]/g,c=>String(c.charCodeAt(0)-0xff10)).replace(/[×xX＊]/g,'*').replace(/[÷／]/g,'/').replace(/[＋]/g,'+').replace(/[−－]/g,'-').replace(/[（]/g,'(').replace(/[）]/g,')').replace(/[．]/g,'.');
        if(source.length>160)throw Error('算式過長');
        const tokens=[];let pos=0;
        while(pos<source.length){
            if(/\s/.test(source[pos])){pos++;continue;}
            const number=source.slice(pos).match(/^(?:(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d*)?|\.\d+)/);
            if(number){tokens.push(Number(number[0].replaceAll(',','')));pos+=number[0].length;}
            else if('+-*/()'.includes(source[pos]))tokens.push(source[pos++]);
            else throw Error('只支援數字、加減乘除與括號');
            if(tokens.length>100)throw Error('算式過長');
        }
        let index=0,depth=0;
        const safe=value=>{if(!Number.isFinite(value)||Math.abs(value)>Number.MAX_SAFE_INTEGER)throw Error('金額超出範圍');return value;};
        const atom=()=>{
            if(++depth>20)throw Error('括號過多');
            let value;const token=tokens[index++];
            if(token==='+'||token==='-')value=(token==='-'?-1:1)*atom();
            else if(token==='('){value=sum();if(tokens[index++]!==')')throw Error('請補齊括號');}
            else if(typeof token==='number')value=token;
            else throw Error('請完成算式');
            depth--;return safe(value);
        };
        const product=()=>{let value=atom();while(tokens[index]==='*'||tokens[index]==='/'){const op=tokens[index++],right=atom();if(op==='/'&&right===0)throw Error('不能除以 0');value=safe(op==='*'?value*right:value/right);}return value;};
        const sum=()=>{let value=product();while(tokens[index]==='+'||tokens[index]==='-'){const op=tokens[index++],right=product();value=safe(op==='+'?value+right:value-right);}return value;};
        const result=sum();if(index!==tokens.length)throw Error('請檢查算式');
        // Monetary inputs retain up to two decimals, avoiding 0.1 + 0.2 artifacts.
        return Math.sign(result)*Math.round((Math.abs(result)+Number.EPSILON)*100)/100;
    }
    function preview(input){try{return {value:calculate(input),error:'',expression:typeof input==='string'&&/[+\-*/×÷xX()（）−－]/.test(input)}}catch(error){return {value:null,error:error.message,expression:false}}}
    root.AmountExpression={calculate,preview};
    if(typeof module!=='undefined'&&module.exports)module.exports=root.AmountExpression;
})(globalThis);
