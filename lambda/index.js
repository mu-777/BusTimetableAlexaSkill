/* *
 * This sample demonstrates handling intents from an Alexa skill using the Alexa Skills Kit SDK (v2).
 * Please visit https://alexa.design/cookbook for additional examples on implementing slots, dialog management,
 * session persistence, api calls, and more.
 * */
const Alexa = require('ask-sdk-core');
const dateFns = require('date-fns');
const dateFnsLocaleJa = require('date-fns/locale/ja');
const fs = require('fs');
const csvParseSync = require('csv-parse/sync');
const { getJstNow, dateToTimeJaStr, getDateFromDayOfWeek, dayOfWeekStrToNum } = require('./util')

const TimetableType = Object.freeze({
    Weekday: 'Weekday',
    Saturday: 'Saturday',
    Sunday: 'Sunday'
});

function LoadTimetableSync(timetableType) {
    const filePath = (timetableType == TimetableType.Sunday) ? "sunday.csv"
        : (timetableType == TimetableType.Saturday) ? "saturday.csv"
            : "weekday.csv"
    return csvParseSync.parse(fs.readFileSync(filePath), {
        relax_column_count: true
    }).reduce((acc, [key, ...values]) => ({ ...acc, [parseInt(key)]: values.map(v => parseInt(v, 10)) }), {});
}

// This returns [the 1st nearest, the 2nd nearest]
function GetCandidateTime(date) {
    const timetableType = (date.getDay() == 0) ? TimetableType.Sunday
        : (date.getDay() == 6) ? TimetableType.Saturday
            : TimetableType.Weekday;
    const timetable = LoadTimetableSync(timetableType);

    const getDateFromTime = (hour, minute) => {
        const dateStr = dateFns.format(date, "yyyy-MM-dd",
            { locale: dateFnsLocaleJa });
        return dateFns.parse(`${dateStr} ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`,
            'yyyy-MM-dd HH:mm', new Date(), { locale: dateFnsLocaleJa });
    }

    const getNearestTime = (targetDate) => {
        const [hour, minute] = [targetDate.getHours(), targetDate.getMinutes()];
        const minHourInTimetable = Math.min(Object.keys(timetable));
        if (hour < minHourInTimetable) {
            return getDateFromTime(minHourInTimetable, timetable[minHourInTimetable][0]);
        }
        const maxHourInTimetable = Math.max(Object.keys(timetable));
        if (hour > maxHourInTimetable) {
            return null;
        }
        let nextIndex = timetable[hour].findIndex(v => v > minute);
        return (nextIndex >= 0) ? getDateFromTime(hour, timetable[hour][nextIndex])
            : (hour != maxHourInTimetable) ? getDateFromTime(hour + 1, timetable[hour + 1][0])
                : null;
    }

    const nearest1stTime = getNearestTime(date);
    const nearest2ndTime = getNearestTime(nearest1stTime);
    return [nearest1stTime, nearest2ndTime];
}

function getKSPBusAnswer(candidates) {
    return (candidates[0] === null) ? `今日の便はもうありません。`
        : (candidates[1] === null) ? `次の便は${dateToTimeJaStr(candidates[0])}で、その次はもうありません。`
            : `次の便は${dateToTimeJaStr(candidates[0])}で、その次は${dateToTimeJaStr(candidates[1])}です。`;
}

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speakOutput = 'はい、時刻をお知らせください';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const AskNextKSPBusIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskNextKSPBusIntent';
    },
    handle(handlerInput) {
        const candidates = GetCandidateTime(getJstNow());
        const speakOutput = getKSPBusAnswer(candidates);
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }

}

const AskKSPBusWithTimeIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AskKSPBusWithTimeIntent';
    },
    handle(handlerInput) {
        const time = handlerInput.requestEnvelope.request.intent.slots.time.value;
        if (!time) {
            const speakOutput = "認識に失敗しました。再度、時刻をお知らせください。"
            return handlerInput.responseBuilder
                .speak(speakOutput)
                .reprompt(speakOutput)
                .getResponse();
        }
        const dayofweek = handlerInput.requestEnvelope.request.intent.slots.dayofweek.value;
        const date = dayofweek ? getDateFromDayOfWeek(dayOfWeekStrToNum(dayofweek))
            : handlerInput.requestEnvelope.request.intent.slots.date.value || dateFns.format(getJstNow(), "yyyy-MM-dd", { locale: dateFnsLocaleJa });

        const inputDate = dateFns.parse(`${date} ${time}`, 'yyyy-MM-dd HH:mm',
            new Date(), { locale: dateFnsLocaleJa });

        const candidates = GetCandidateTime(inputDate);
        const speakOutput = getKSPBusAnswer(candidates);
        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const HelpIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speakOutput = '時刻をお知らせいただいたら、それに近いKSPバスの時間をお伝えします';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && (Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.CancelIntent'
                || Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speakOutput = 'ありがとうございました';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .getResponse();
    }
};
/* *
 * FallbackIntent triggers when a customer says something that doesn’t map to any intents in your skill
 * It must also be defined in the language model (if the locale supports it)
 * This handler can be safely added but will be ingnored in locales that do not support it yet 
 * */
const FallbackIntentHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest'
            && Alexa.getIntentName(handlerInput.requestEnvelope) === 'AMAZON.FallbackIntent';
    },
    handle(handlerInput) {
        const speakOutput = 'すみません、理解できませんでした';

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};
/* *
 * SessionEndedRequest notifies that a session was ended. This handler will be triggered when a currently open 
 * session is closed for one of the following reasons: 1) The user says "exit" or "quit". 2) The user does not 
 * respond or says something that does not match an intent defined in your voice model. 3) An error occurs 
 * */
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        console.log(`~~~~ Session ended: ${JSON.stringify(handlerInput.requestEnvelope)}`);
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse(); // notice we send an empty response
    }
};
/* *
 * The intent reflector is used for interaction model testing and debugging.
 * It will simply repeat the intent the user said. You can create custom handlers for your intents 
 * by defining them above, then also adding them to the request handler chain below 
 * */
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return Alexa.getRequestType(handlerInput.requestEnvelope) === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = Alexa.getIntentName(handlerInput.requestEnvelope);
        const speakOutput = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speakOutput)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};
/**
 * Generic error handling to capture any syntax or routing errors. If you receive an error
 * stating the request handler chain is not found, you have not implemented a handler for
 * the intent being invoked or included it in the skill builder below 
 * */
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        const speakOutput = 'Sorry, I had trouble doing what you asked. Please try again.';
        console.log(`~~~~ Error handled: ${JSON.stringify(error)}`);

        return handlerInput.responseBuilder
            .speak(speakOutput)
            .reprompt(speakOutput)
            .getResponse();
    }
};

/**
 * This handler acts as the entry point for your skill, routing all request and response
 * payloads to the handlers above. Make sure any new handlers or interceptors you've
 * defined are included below. The order matters - they're processed top to bottom 
 * */
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        AskNextKSPBusIntentHandler,
        AskKSPBusWithTimeIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        FallbackIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler)
    .addErrorHandlers(
        ErrorHandler)
    .withCustomUserAgent('sample/hello-world/v1.2')
    .lambda();