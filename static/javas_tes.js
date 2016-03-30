var G_Handler = null;
var G_Updater = null;

var Updater = (function(){
    function Updater(socket) {
        this.socket = socket;
        this.socket.onmessage= this.showMessage;
        this.textClasses = [];
    }

    Updater.prototype.reset = function(){
        this.textClasses = [];
    }

    Updater.prototype.sendMessage = function(message, isFinal){
        var result = true;
        if (!isFinal){
        var Json_message = JSON.stringify({
            "status": isFinal,
            "message": message,
            "interval": G_Handler.interval,
            "sentenceCount": G_Handler.recognized.length - G_Handler.sendStart
        });
        }else {
        var Json_message = JSON.stringify({
            "status": isFinal,
            "message": G_Handler.makeFinalMessage(),
            "interval":G_Handler.getTime(),
            "sentenceCount":G_Handler.recognized.length
                    });
        }
        try {
            this.socket.send(Json_message);
        }catch(e){
            console.log(e);
            result = false;
        }
        return result;
    };

    Updater.prototype.showMessage = function(event){
        var jsObject = JSON.parse(event.data)
        if ("class" in jsObject){
            G_Updater.displayScore(jsObject);
        }
    };

    Updater.prototype.displayScore = function(jsObject) {

        var text = jsObject["text"]
        var textClass = jsObject["class"]

        this.textClasses.push(textClass);

        var ratio = function(array, target) {
          count = 0
          array.forEach(function(val,index,ar) {
            if (val == target) {
              count ++;
            }
          })
          return count / array.length;
        }

        dubious_border = 0.6;
        dubious_min_count = 4;

        var talkDubious = false;
        if (ratio(this.textClasses, "dubious") > dubious_border
         && this.textClasses.length > dubious_min_count) {
            talkDubious = true;
        }

        var format = "<tr %STYLE%><td>%TEXT%</td><td>%TEXT_CLASS%</td><td>%TALK_DUBIOUS%</td></tr>";
        var newScore = "";

        if(talkDubious){
            style = "class='danger'";
        }else {
            style = "class='success'";
        }

        if(jsObject["status"]){ // 通話終了時
            scoreLog = "<div>Final: text_class:"+textClass+", talk_dubious:"+talkDubious+"<div>" ;
            newScore = format.replace("%TEXT%", "Result").replace("%TEXT_CLASS%", "");
            newScore = newScore.replace("%TALK_DUBIOUS%", talkDubious).replace("%STYLE%", "class='table-border'");
        }else{ // 通話途中
            scoreLog = "<div>" + this.textClasses.length +
                       "回目: text_class:" + textClass+", talk_dubious:"+talkDubious+"<div>" ;
            newScore = format.replace("%TEXT%", text).replace("%TEXT_CLASS%", textClass);
            newScore = newScore.replace("%TALK_DUBIOUS%", talkDubious).replace("%STYLE%", style);
        }

        $("#tblScore tbody").append(newScore);
        $('#scores').append(scoreLog);
    };

    Updater.prototype.timer = function(){
        timer=parseInt(G_Handler.getTime()/1000);
	    hour = parseInt(timer / 3600);
	    min = parseInt((timer / 60) % 60);
	    sec = timer % 60;

        var zeroPad = function(value){
            return value < 10 ? "0" + value : value;
        }

        textTime=zeroPad(hour)+":"+zeroPad(min)+":"+zeroPad(sec);
        $("#timer").text(textTime);

    };

    return Updater;
})();


$(document).ready(function() {
    var url = "ws://" + location.host + "/websocket";
    var socket = new WebSocket(url);
    G_Updater = new Updater(socket);
    var textClasses = []

    var speechEventHandler = {
        onend: function(e){
            $('#log').append("<div>end</div>");
        },
        onerror: function(e){
            $('#log').append("<div>error:" + event.error + "</div>");
        },
        onresult: function(e){
            var status = (e.results[e.results.length - 1].isFinal ? "Final" : "Resume");
            var log = "<span class='recognized'>FIXED</span><span class='recognizing'>REC</span>";
            log = log.replace("FIXED", G_Handler.recognizedstr());
            log = log.replace("REC", G_Handler.recognizing);
            log = status + ":" + log;
            $('#log').append("<div>result:" + log + "</div>");

            var speech = G_Handler.makeMessage();
            $("#speechArea").text(speech);
        },
        onsend: function(message){
            $('#log').append("<div>send:" + message + "</div>");
        }
    }

    G_Handler = new SpeechHandler(15000, G_Updater, speechEventHandler);

    $('#btnPresentation').click(function () {
        // unsupported.
        if (!'webkitSpeechRecognition' in window) {
            alert('Web Speech API には未対応です.');
            return;
        }

        if (G_Handler.isRecording()) {
            G_Handler.send(true); //send final part
            G_Handler.reset();
            G_Updater.reset();
            this.value = "通話開始";
            $(this).removeClass("btn-danger")
            $(this).addClass("btn-primary")
        } else {
            //init display
            $("#speechArea").empty();
            $("#tblScore tbody").empty();
            $("#log").empty();
            $("#scores").empty();

            var lang = $('#ddlLang').val();

            G_Handler.start(lang);
            this.value = "通話終了";
            $(this).removeClass("btn-primary")
            $(this).addClass("btn-danger")
        }
    });
});

var SpeechHandler = (function () {
    function SpeechHandler(interval, sender, eventHandler) {
        this.recognition = null;
        this.timerId = null; //Time they press a button
        this.sender = sender;
        this.interval = interval;
        this.eventHandler = eventHandler;

        this.recognized = [];
        this.recognizing = "";
        this.sendStart = 0;
        this.sentPortion = 0;
    };

    SpeechHandler.prototype.isRecording = function () {
        if(this.timerId != null){
            return true;
        }else{
            return false;
        }
    }

    SpeechHandler.prototype.start = function (lang) {
        this.recognition = new webkitSpeechRecognition();
        this.recognition.lang = lang;
        this.recognition.continuous = true;
        this.recognition.interimResults = true;
        this.startTime=new Date();


        this.recognition.start();
        this.recognition.onend = this.onend;
        this.recognition.onresult = this.onresult;
        this.recognition.onerror = this.onerror;
        this.initParameter();

        this.timerId = setInterval(function(){
            G_Handler.send(false);
        }, this.interval)

        G_Updater.timer();
        this.elapsedId = setInterval(function(){
            G_Updater.timer();
        }, 1000)
    };

    SpeechHandler.prototype.initParameter = function(e){
        this.recognized = [];
        this.recognizing = "";
        this.sendStart = 0;
        this.sentPortion = 0;
    }

    SpeechHandler.prototype.onend = function(e){
        // it'll end when speech is not recognized in long time.
        G_Handler.eventHandler.onend(e);
    }
    SpeechHandler.prototype.onerror=function(e){
        G_Handler.eventHandler.onerror(e);
    };

    SpeechHandler.prototype.onresult = function (e) {
        var interimText = '';
        var last = e.results.length-1;
        if (e.results[last].isFinal) {
            var fixed = e.results[last][0].transcript;
            G_Handler.recognized.push(fixed);
            //G_Handler.recognizing = G_Handler.recognizing.replace(fixed, "");
            G_Handler.recognizing ="";
        } else {
            G_Handler.recognizing = e.results[last][0].transcript;
            if(last > 0){
                if (!e.results[last-1].isFinal){
                    G_Handler.recognizing = e.results[last-1][0].transcript + e.results[last][0].transcript;
                }
            }
        }
        G_Handler.eventHandler.onresult(e);
    };

    SpeechHandler.prototype.recognizedstr = function () {
        var speech = "";
        for(var i = this.sendStart; i < this.recognized.length; i++){
            speech += this.recognized[i];
        }
        return speech;
    }

    SpeechHandler.prototype.makeMessage = function () {
        var speech = this.recognizedstr();
        speech += this.recognizing;
        speech = speech.substring(this.sentPortion);
        return speech;
    }

    SpeechHandler.prototype.makeFinalMessage = function () {
        var speech = "";
        for(var i = 0; i < this.recognized.length; i++){
            speech += this.recognized[i];
        }
        speech += this.recognizing;
        return speech;
    }

    SpeechHandler.prototype.send = function (isFinal) {
        var speech = this.makeMessage();
        this.eventHandler.onsend(speech);
        if(speech || isFinal){
            this.sender.sendMessage(speech, isFinal);
        }

        this.sendStart = this.recognized.length;
        this.sentPortion = this.recognizing.length;
    };

    SpeechHandler.prototype.getTime = function(){
        return (new Date()) - this.startTime;
    }

    SpeechHandler.prototype.reset = function () {
        clearInterval(this.elapsedId);
        clearInterval(this.timerId);
        this.timerId = null;
        this.recognition.abort();
        this.initParameter();
    };

    return SpeechHandler;
})();
