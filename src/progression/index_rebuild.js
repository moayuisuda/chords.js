import {
    Time,
    Transport,
    Part
} from 'tone'
import {
    template,
    loopMap,
    synth
} from './sources'
import {
    chord as getChord
} from '../rad.js/index'
import {
    ChordItem
} from './chordItem'
import Vue from 'vue/dist/vue.js'
import {handleFiles} from './utils'

let instance = new Vue({
    template,
    data: {
        flag: 0,
        bpm: 50,
        type: 'scale',
        types: [
            'scale'
        ],
        input: {
            single: '4',
            amount: '4',
            chord: 'C'
        },
        initOctive: 4,
        timeline: [],
        json: [],
        playing: false
    },

    watch: {
        bpm: {
            handler(val, oldVal) {
                Transport.bpm.value = val;
                this.caculateTime();
            },
            immediate: true
        },
    },

    methods: {
        toggle() {
            if (this.playing) this.stop();
            else this.start();
        },

        start() {
            this.playing = true;
            Transport.stop();
            Transport.start();
        },

        stop() {
            this.playing = false;
            this.flag = this.timeline.length - 1;
            Transport.stop();
        },

        exportJson(){
            let data = [];
            for(let i of this.timeline) {
                let {amount, single, chord, type} = i;
                data.push({
                    amount,
                    single,
                    chord,
                    type
                })
            }

            let json = JSON.stringify(data, undefined, 4)
            var blob = new Blob([json], {type: 'text/json'}),
            e = document.createEvent('MouseEvents'),
            a = document.createElement('a')
            a.download = 'RAD-PROGRESSION.json'
            a.href = window.URL.createObjectURL(blob)
            a.dataset.downloadurl = ['text/json', a.download, a.href].join(':')
            e.initMouseEvent('click', true, false, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null)
            a.dispatchEvent(e)
        },

        async importJson(e) {
            let data = await handleFiles(e);
            let json = JSON.parse(data);
            for(let i of json) {
                let {
                    amount,
                    single,
                    chord,
                    type,
                } = i;
                let chordArr;
    
                try {
                    chordArr = getChord(chord, this.initOctive);
                } catch (e) {
                    console.log(e);
                    return;
                }
    
                if (!(amount.match(/^\d$/) && single.match(/^\d$/)))
                    throw `[Rad-Club] The parameter "${amount}/${single}" is not valid`
    
                let time = Time(`${single}n`) * amount,
                loop = loopMap[type](synth, chordArr, single);
                loop.loop = 3;
                let chordItem = new ChordItem({
                    chord,
                    loop,
                    time,
                    amount,
                    single,
                    instance: this
                })
    
                this.timeline.splice(this.flag + 1, 0, chordItem);
            }

            this.caculateTime();
        },
        // single is one beat length, and amount is how many times this beat would be triggered.
        add() {
            let {
                amount,
                single,
                chord
            } = this.input;
            let type = this.type;
            let chordArr;

            try {
                chordArr = getChord(chord, this.initOctive);
            } catch (e) {
                console.log(e);
                return;
            }

            if (!(amount.match(/^\d$/) && single.match(/^\d$/)))
                throw `[Rad-Club] The parameter "${amount}/${single}" is not valid`

            let loop = loopMap[type](synth, chordArr, single);
            let chordItem = new ChordItem({
                chord,
                loop,
                type,
                amount,
                single,
                instance: this
            })

            this.timeline.splice(this.flag + 1, 0, chordItem);
            this.caculateTime();

            // only when focus() is invoked can flag be added, if you call add() very quickly, an  the focus have a 32n delay, so you will see a
            // bug which the flag is not set on the last ChordItem in the timeline.
            this.timeline[chordItem.flag].focus();
        },

        remove(instance) {
            this.timeline.splice(instance.flag, 1);
            this.caculateTime();
        },

        caculateLoop() {
            let tile = this.timeline[this.timeline.length - 1];
            if (tile) {
                Transport.loopEnd = this.timeline[this.timeline.length - 1].stop;
                Transport.loop = true;
            } else Transport.loop = false;
        },

        caculateTime() {
            console.log('recaculate..');
            let timeFlag = Time(0);
            let flag = 0;
            for (let item of this.timeline) {
                let {
                    loop,
                    amount,
                    single
                } = item;

                let start = timeFlag;
                timeFlag += amount * Time(`${single}n`);
                let stop = timeFlag;

                item.start = start;
                item.stop = stop;
                item.flag = flag++;
                
                loop.cancel(0);
                loop.start(item.start);
                loop.loop = amount;

                Transport.schedule((time) => {
                    item.setFlag();
                }, item.start);
            }

            this.caculateLoop();
        }
    }
})

export {
    instance
}