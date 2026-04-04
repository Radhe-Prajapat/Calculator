// Yeh function math ko securely evaluate karna ke liye banaya gaya hai.
// "eval()" keyword danger hotha hai kyunki wo any code run kar sakta hai, isliye hum use bach kar isse use karenge.
const safeEval = (str) => {
    try {
        // Regex (Pattern match): Sirf numbers (0-9), mathematical operators (+, -, *, /) aur brackets hi allow karo.
        if (!/^[0-9+\-*/.%() ]+$/.test(str)) return '';
        
        // Agar percentage (%) hai toh usko divide by 100 (/100) kardo math rule ke hisab se.
        let evalStr = str.replace(/(\d+)%/g, '($1/100)');
        
        // Naya Function string ko number expression me badalke chalayega.
        return new Function('return ' + evalStr)();
    } catch {
        return ''; // Agar kuch galat add ho gaya toh error nai throw karega bas empty dega
    }
};

// Main Calculator Program ki Blueprint (Class)
class SuperCalculator {
    
    // Sab se pehle Constructor function chalta hai jab program start hota hai
    constructor() {
        this.currentOp = '0'; // Current typing value jo display pe dikhegi initial '0' pr rakh k start hoti hain
        this.expression = ''; // Puri mathematical equation (e.g. "12+43") yaha store hogi background calculation p.
        
        // Pichli calculations ko yaad rakhne k lye hum Local Storage use karege, take page refresh pe delete nay hoy
        this.history = JSON.parse(localStorage.getItem('calc_history')) || [];
        
        this.cacheDOM();       // Sare HTML element ko JS variablon par layega
        this.bindEvents();     // Buttons, key-press inn sub clicks ko listen karna shuro kr de
        this.initAudio();      // Beep waali awaaz k engine ko tyyr raakhna load krna..
        this.renderHistory();  // Screen pe History load karao
        this.updateDisplay();  // Screen pe basic '0' dikhana shuru kro
    }

    // HTML elements idhr js variables mein load kiye jatey hain taaki asani sy select hor unpar kaam ho sakey..
    cacheDOM() {
        this.currentDisplay = document.getElementById('current-operand');
        this.prevDisplay = document.getElementById('previous-operand');
        this.previewDisplay = document.getElementById('real-time-preview');
        this.buttons = document.querySelectorAll('.btn'); // Ye ek button nahi sub button ko layga group banakr (NodeList)
        this.calculator = document.getElementById('calculator');
        this.historyPanel = document.getElementById('history-panel');
        this.historyList = document.getElementById('history-list');
        this.displayArea = document.getElementById('display-area');

        // Top controls toggle buttons
        this.themeToggle = document.getElementById('theme-toggle');
        this.themeIcon = document.getElementById('theme-icon');
        this.historyToggle = document.getElementById('history-toggle');
        this.closeHistory = document.getElementById('close-history');
        this.clearHistoryBtn = document.getElementById('clear-history');
    }

    // Awaaz play karne ke liye system setup start
    initAudio() {
        try {
            // Audio engine run kro browser ka check karke kon sa h window ka part..
            this.audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        } catch(e) {
            console.log("Audio API not supported"); // old browser ki limit
        }
    }

    // Haptic feedback -> Mobile phone mein click karne par subtle vibration 
    playHaptic() {
        if(navigator.vibrate) { // check krte hy k phon mai vibration mtr hei ?
            navigator.vibrate(10); // 10ms yani halqi si tuk vibration hogi..
        }
    }

    // Alag-alag buttano ke liye alag click sound effects (Tick Tick) code
    playSound(type = 'click') {
        if (!this.audioCtx) return; // Audio load nhi ha too wapis chly jawo..
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();

        // different pitch ki aawaz ( Equal ki aawaz zayida unchi lagni chahiye )
        if(type === 'equal') {
            osc.frequency.setValueAtTime(800, this.audioCtx.currentTime);     // start volume pitch
            osc.frequency.exponentialRampToValueAtTime(200, this.audioCtx.currentTime + 0.1); 
        } else if(type === 'clear') { // Clear aur AC waly button
            osc.frequency.setValueAtTime(300, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(100, this.audioCtx.currentTime + 0.05);
        } else { // baki buttons k normal math sound
            osc.frequency.setValueAtTime(600, this.audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(150, this.audioCtx.currentTime + 0.04);
        }

        // Output awaz loud or fate naii uskay liye level 0.1 pe rakha hai and fade kar den..
        gain.gain.setValueAtTime(0.1, this.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.audioCtx.currentTime + 0.05);

        // Sound connect karo system speakers s play and band karoo..
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start();
        osc.stop(this.audioCtx.currentTime + 0.1);
        this.playHaptic();
    }

    // Paani me chot padne jaesa goal lehron ka effect (Ripple Animation)
    createRipple(e, btn) {
        const circle = document.createElement('span'); // gol elements bano js me e k liye span use kro html m!
        const diameter = Math.max(btn.clientWidth, btn.clientHeight);
        const radius = diameter / 2;

        const rect = btn.getBoundingClientRect(); // Button ka frame kahan pe padh raha ha position coordinate lo!
        
        // Touch or Click kaha laga uspe se Center of Wave nikalo (Ya theek beech mai rakho fallback)
        const clientX = e.clientX || rect.left + radius;
        const clientY = e.clientY || rect.top + radius;

        circle.style.width = circle.style.height = `${diameter}px`;
        circle.style.left = `${clientX - rect.left - radius}px`; // Left c adjust krna center ko..
        circle.style.top = `${clientY - rect.top - radius}px`;   // Top c adjust..
        circle.classList.add('ripple'); // CSS m is naam se Ripple animation phle c dala rkkha ! Usko invoke kre gyi 

        const ripple = btn.querySelector('.ripple'); // agr purana koii h tou hatwa do usse jisse speed masla ne de system .. 
        if (ripple) ripple.remove();
        btn.appendChild(circle); // Naya circle andar div pe dalo!
    }

    // Har action Event is Block pe hota h set Button Clicks Key press etc...
    bindEvents() {
        
        // For each loop matlab saare .btn div buttons pe logic fit kara do ak hi barr mei Array read format main..
        this.buttons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.createRipple(e, btn);       // Sabse pehele pani jaisa wave dikhao
                const action = btn.dataset.action; // data-action kya the html btn m? like 'delete', 'operator' ? vo uthao..
                const val = btn.dataset.val;       // data-val kis number ko batae ga? '7' '6' '-' etc..  wo laoo

                // GSAP se click krne par normal si scale up nd scale down (Bouncy feel) thoda do ...
                // Sirf button scale hoga par poora calculator hilega nahi
                if (typeof gsap !== 'undefined') {
                    gsap.fromTo(btn, { scale: 0.95 }, { scale: 1, duration: 0.2, ease: "back.out(2)" });
                }

                // Call Different Methods using actions ->  (Number padhnay, math plus divide logic handle krna wagra..) 
                if (!action) {
                    this.appendNumber(val); // Num liko aagya..
                    this.playSound('click');
                } else if (action === 'operator') {
                    this.appendOperator(val); // plus, minus krna h to upper lejaoo working k...
                    this.playSound('click');
                } else if (action === 'calculate') {
                    this.calculate(); // Hit 'equals to' Calculation execute
                    this.playSound('equal');
                } else if (action === 'clear') {
                    this.clear();    // Poora clear 'AC' krden
                    this.playSound('clear');
                } else if (action === 'delete') {
                    this.delete();   // Backspace 1 akshr krden 
                    this.playSound('click');
                }
            });
        });

        // Apne Keyboard se Button type krne pr bhi sunni chaiiye .. (Key Listener Event)
        document.addEventListener('keydown', (e) => {
            let key = e.key; // kaunsi ki press hoi "a, 1, esc, space ?" wo bataega . 
            
            // Map common keyboard keys to our calculator symbols 
            if (key === 'Enter') key = '=';
            if (key === 'Escape') key = 'AC';
            if (key === 'Backspace') key = 'DEL';
            
            const map = {
                '=': '[data-action="calculate"]',
                'AC': '[data-action="clear"]',
                'DEL': '[data-action="delete"]'
            };

            // Dhoondo selector query main .. Ex : document.query( [data-val='7'] ); ese html format padhega JS. !
            let selector = map[key];
            if(!selector && '0123456789.'.includes(key)) selector = `[data-val="${key}"]`;
            if(!selector && '+-*/%'.includes(key)) selector = `[data-val="${key}"]`;

            if (selector) {
                const btn = document.querySelector(selector); // HTML ka button catch karlo query sy memory m uth kar!
                if (btn) {
                    e.preventDefault(); // browser ka Default kaam mna krdoo default press event block karo space wageran s pages neechi nhh hoga 
                    btn.classList.add('pressed'); // style wgera .pressed classes daaldi glow c !
                    setTimeout(() => btn.classList.remove('pressed'), 150); // button chor de gya effect c bahar.
                    btn.click(); // Aur JS mein click fake button code se maroo to event uper jaaega! .. Trigger call hit!
                }
            }
        });

        // Theme Toggle Button (Light ya dark themes ke lagana  CSS body toggle)
        this.themeToggle.addEventListener('click', () => {
            document.body.classList.toggle('light'); // toggles =  hai toh hatayega nahi hai to class lggdga bdiya JS fun!
            const isLight = document.body.classList.contains('light'); // true ho to smjho  White theme m.
            this.themeIcon.className = isLight ? 'fas fa-sun' : 'fas fa-moon'; // icons dark/light m switch ho jyygy!
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(this.themeToggle, {rotation: 0}, {rotation: 360, duration: 0.5}); // chakri ghumoo button p !
            }
            this.playSound('click');
        });

        // History Menu Toggle Buttons
        this.historyToggle.addEventListener('click', () => {
            this.toggleHistory(true); 
            this.playSound('click');
        });

         // history btn pe Cross icon band karne ko hide k liyey . ..
        this.closeHistory.addEventListener('click', () => {
            this.toggleHistory(false);
            this.playSound('click');
        });

        this.clearHistoryBtn.addEventListener('click', () => {
            this.history = []; // System Storage list Zero
            localStorage.setItem('calc_history', JSON.stringify([])); // browser disk DB se bhi khtm dlt krna 
            this.renderHistory();
            this.playSound('clear');
        });

        // ==== Mobile Phone Swipe karne par calculation me logic dalna ====
        let touchstartX = 0;
        let touchstartY = 0;
        
        this.displayArea.addEventListener('touchstart', e => {
            touchstartX = e.changedTouches[0].screenX; // Shuru kis x and y sy pkaada.. 
            touchstartY = e.changedTouches[0].screenY;
        }, {passive: true});

        this.displayArea.addEventListener('touchend', e => {
            let touchendX = e.changedTouches[0].screenX; // End ungli kha c uthii ? coordinate pakden...
            let touchendY = e.changedTouches[0].screenY;
            
            let diffX = touchstartX - touchendX; // Horizontal calculation  
            let diffY = touchstartY - touchendY;

            // Agar Swipe Right ya left thoda tezz krdiya ha..
            if (Math.abs(diffX) > 50 && Math.abs(diffY) < 50) {
                this.delete(); // To ak back space kardo number pr..
                this.playSound('click');
            }
            // Agr Upar se niiche ki or kheecha Vertical "AC" kaam lag jaagy clear hga board .. 
            else if (diffY > 50 && Math.abs(diffX) < 50) {
                this.clear();
                this.playSound('clear');
            }
        });
    }

    // Toggle menu CSS Add class List s CSS p panel dkhyegyy ya chupeygy logic 
    toggleHistory(show) {
        if(show) {
            this.historyPanel.classList.add('active'); // show up  m .active css class 
            if (typeof gsap !== 'undefined') {
                gsap.fromTo(this.historyPanel, 
                    { y: 100, opacity: 0 }, 
                    { y: 0, opacity: 1, duration: 0.4, ease: "power3.out" }  // popup badiya float hokrr uper p aye gyii effect c!.!
                );
            }
        } else {
            if (typeof gsap !== 'undefined') {
                gsap.to(this.historyPanel, {
                    y: 100, opacity: 0, duration: 0.3, onComplete: () => {
                        this.historyPanel.classList.remove('active'); // anim khatam krne k bath hi classes m gayba ho active wali css ! 
                    }
                });
            } else {
                this.historyPanel.classList.remove('active');
            }
        }
    }

    // List loop pr print in html memory data Array. 
    renderHistory() {
        this.historyList.innerHTML = '';
        if(this.history.length === 0) { //  0 array no log! 
            this.historyList.innerHTML = '<div style="color:var(--text-muted); text-align:center; padding: 20px;">NO LOGS FOUND</div>';
            return;
        }

        this.history.forEach((item) => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="h-expr">${item.expr}</div> 
                <div class="h-res">${item.res}</div> 
            `;
            // Purani History dbakar Wapis result main value read out karo uske liye Listener chahiya na click k.. !! 
            div.addEventListener('click', () => {
                this.currentOp = item.res; // Result as current start set karo .. 
                this.expression = item.res; 
                this.updateDisplay(); // Screen pe wapis se print la do !! 
                this.toggleHistory(false); 
            });
            this.historyList.appendChild(div); // Node main insert krte jaw html page ander add element dkhny lagegy !! 
        });
    }

    // Memory History  System update record Array p lagttr add krti h ..
    addHistory(expr, res) {
        this.history.unshift({ expr, res }); // Top per item fresh wala rakhti hy add krky ! (push bottom m jata h par unshift() array k first uper dalta hy hmesha) !! 
        if (this.history.length > 20) this.history.pop(); // Last record Pop krti rhe takk memory cache n  bade aur UI p 20 sa zayda lists aagui tw speed low hogi.. 
        localStorage.setItem('calc_history', JSON.stringify(this.history)); // Local Storage k system format main String banke layjaga text json formt.
        this.renderHistory();
    }

    // Logic: Number dalne par equation or screen variable ko Update/Add karna string mein  
    appendNumber(number) {
        if (this.currentOp === 'Error') this.currentOp = '';
        
        let parts = this.expression.split(/[\+\-\*\/\%]/); // Last ka formula value padho ex -> '10*2 ' to parts main last [2] hoga 
        let currTerm = parts[parts.length-1];

        // Do bar dot .. likhny s stop karna ..! 
        if (number === '.' && currTerm.includes('.')) return;
        
        // Zero clear start over .. 
        if (this.currentOp === '0' && number !== '.') {
            this.currentOp = number;
            // update expr safely
            if(this.expression === '0') this.expression = number;
            else this.expression += number;
        } else {
            // Screen ko bhrny limit limit k bahr string nhi jaye warna layout fat jagi!
            if(currTerm.length > 15) return;
            // = lagane ke baad num dabe tab equation fresh aur starting start hoti he.
            if(this.expression.includes('=') || this.evaluated) {
                this.expression = number === '.' ? '0.' : number;
                this.currentOp = this.expression;
                this.evaluated = false;
            } else {
                this.currentOp += number; // aky ak k aagay 1 .. . "11" "text mode concatinate array .." 
                this.expression += number;
            }
        }
        this.updateDisplay();
        this.updatePreview();
    }

    // Logic: Plus / Minus logic p calculation hold operator change. 
    appendOperator(op) {
        if (this.currentOp === 'Error') return;
        if (this.expression === '') { // shuru k case.. ->  -5 iske lye theek . 
            if(op === '-') {
                this.expression = '-';
                this.currentOp = '-';
                this.updateDisplay();
            }
            return;
        }

        // = lagke kch evaluate horuka tha piche.. toh  answer c lekr age badhna.. result variable aagye do + k..  (ans+5) => 
        if(this.evaluated) {
            this.expression = this.currentOp + op;
            this.evaluated = false;
        } else {
            // Operator ke check (last character of formula pichla kya tha) ex -> 10 + (- dba ab).. toh wo replace maro '+' cut and - daalo !! 
            const lastChar = this.expression.slice(-1); 
            if ('+-*/%'.includes(lastChar)) {
                this.expression = this.expression.slice(0, -1) + op;
            } else {
                this.expression += op;
            }
        }
        
        this.currentOp = ''; // operator tyep krne ke badd normal num wait karta hai to islo khali chord do 
        this.updateDisplay();
        this.updatePreview();
    }

    // The heart : Calculations output result generate code yha execute hgii ...
    calculate() {
        if (!this.expression || this.evaluated) return;
        
        const lastChar = this.expression.slice(-1);
        let exprToEval = this.expression;
        // Aggr end me extra '+' ya '*' hy too math fail hgi isliye chop kar dalo... (Slice kr k ) -> ("10+" se "10" lo bas result evaluate p pass krne c ple ) 
        if ('+-*/%'.includes(lastChar)) {
            exprToEval = this.expression.slice(0, -1);
        }

        // Divide by 0 infinity hota javascript hang/error Infinity display se fix hai  
        if(exprToEval.includes('/0')) {
            this.handleError("Error"); 
            return;
        }

        const res = safeEval(exprToEval); 
        // JS m Math Engine error output result catch validation   
        if (res === '' || isNaN(res) || !isFinite(res)) {
            this.handleError("Error");
            return;
        }

        // (10.00000005 ko JS mai math bug c theek krne ki technique : round c) 
        let finalRes = Math.round(res * 100000000) / 100000000;
        finalRes = finalRes.toString(); // Vapis Text mai lao layout ko string krdo

        this.addHistory(exprToEval.replace(/\*/g, '×').replace(/\//g, '÷'), finalRes); // Add to history !! 
        
        this.prevDisplay.innerText = exprToEval.replace(/\*/g, '×').replace(/\//g, '÷') + ' ='; // Chota label formula k sath output de do = laga kar piche !! 
        
        this.currentOp = finalRes; 
        this.expression = finalRes; 
        this.evaluated = true; 
        
        this.updateDisplay(true); // Final flag result print function la jao bht import 
        this.previewDisplay.innerText = '';
    }

    handleError(msg) {
        this.currentOp = msg;
        this.expression = ''; // Clear sub kharab values.. formula clean .. 
        this.updateDisplay();
        // Visual shake animation Error Error left right x axis ..
        if (typeof gsap !== 'undefined') {
            gsap.to(this.currentDisplay, { x: [-10, 10, -10, 10, 0], duration: 0.4 });
        }
    }

    clear() {
        this.currentOp = '0';
        this.expression = '';
        this.evaluated = false;
        this.updateDisplay();
        this.previewDisplay.innerText = '';
    }

    delete() { // Backspace working chop ..  end slice char  (1) value
        if (this.currentOp === 'Error' || this.evaluated) {
            this.clear();
            return;
        }
        
        if (this.expression.length > 0) {
            this.expression = this.expression.slice(0, -1);
            if(this.currentOp.length > 0) {
                this.currentOp = this.currentOp.slice(0, -1);
            } else {
                // jab Operator hata tou number current val mein current string dhoondh k nikali split lagaker reverse index!
                let parts = this.expression.split(/[\+\-\*\/\%]/); 
                this.currentOp = parts[parts.length-1] || '';
            }
        }
        
        // Final length string empty = Return Back 0 !  
        if (this.expression === '') {
            this.currentOp = '0';
        }
        
        this.updateDisplay();
        this.updatePreview();
    }

    // Upar bar pe choota chota text Live calculate hota dikhane wala loop .. . !
    updatePreview() {
        if(this.evaluated || !this.expression) {
            this.previewDisplay.innerText = '';
            return;
        }
        // only show preview if there is an operator (ex 10 + .... tab preview answer bataey ) 
        if(/[\+\-\*\/\%]/.test(this.expression)) {
            let exprToEval = this.expression;
            if ('+-*/%'.includes(this.expression.slice(-1))) { // Akhir ki string ka kato ex : "10*" ha to "*" kato ta k "10" sahi eval me jay
                exprToEval = this.expression.slice(0, -1);
            }
            if(exprToEval.includes('/0')) {
                this.previewDisplay.innerText = 'Error';
                return;
            }
            let res = safeEval(exprToEval);
            if(res !== '' && !isNaN(res) && isFinite(res)) {
                res = Math.round(res * 100000) / 100000;
                this.previewDisplay.innerText = res;
            } else {
                this.previewDisplay.innerText = '';
            }
        } else {
            this.previewDisplay.innerText = '';
        }
    }

    // Comma string : USA comma (10,000) bananeka code print logic ! 
    formatNumber(numStr) {
        if(!numStr || numStr === 'Error' || numStr === '-') return numStr;
        const [intPart, decPart] = numStr.toString().split('.'); // Decimal ko dot pe split todho array.. Number [0] index and Decimal  Fraction [1] index
        let formattedStr = '';
        if(intPart) {
            // local formatting (Browser logic base add comma to Big thousands numbers )
            formattedStr = parseInt(intPart, 10).toLocaleString('en');
        }
        if(decPart !== undefined) {
            formattedStr += '.' + decPart; // decimal p point chipka do back print main !
        }
        return formattedStr;
    }

    // Akhiri display update aur visual paint changes yahaan sy html DOM p load hotey 
    updateDisplay(isFinal = false) {
        // dynamic font size (Jaise hi Number lamba hota h too size shrink krne taa ki bhar n nikale display k ) !
        // Mene animation (transition) css se kum kr diya hai ta k screen jump nahi marega aur text ek position pr rahe   
        const displayLen = this.currentOp.length;
        if(displayLen > 12) {
            this.currentDisplay.style.fontSize = '2rem';
        } else if(displayLen > 8) {
            this.currentDisplay.style.fontSize = '2.5rem';
        } else {
            this.currentDisplay.style.fontSize = '3.5rem';
        }

        if(this.evaluated && isFinal) {
            this.currentDisplay.innerText = this.formatNumber(this.currentOp);
            return;
        }

        // Format normal value in HTML Node element display  
        if(this.currentOp.length === 0) {
           this.currentDisplay.innerText = ''; 
        } else {
           this.currentDisplay.innerText = this.formatNumber(this.currentOp); 
        }

        // Format expression math symbols : (*) into multiply sign '×' etc for UI 
        if(!this.evaluated) {
            this.prevDisplay.innerText = this.expression 
                ? this.expression.replace(/\*/g, '×').replace(/\//g, '÷') 
                : '';
        }
    }
}

// Jab document pura properly load ho DOM Engine tayiyar ho tab Calculator App chala do..
document.addEventListener('DOMContentLoaded', () => {
    new SuperCalculator();
});
