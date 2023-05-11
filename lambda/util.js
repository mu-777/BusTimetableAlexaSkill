const AWS = require('aws-sdk');
const dateFns = require('date-fns');
const dateFnsLocaleJa = require('date-fns/locale/ja');

const s3SigV4Client = new AWS.S3({
    signatureVersion: 'v4',
    region: process.env.S3_PERSISTENCE_REGION
});

function getS3PreSignedUrl(s3ObjectKey) {

    const bucketName = process.env.S3_PERSISTENCE_BUCKET;
    const s3PreSignedUrl = s3SigV4Client.getSignedUrl('getObject', {
        Bucket: bucketName,
        Key: s3ObjectKey,
        Expires: 60 * 1 // the Expires is capped for 1 minute
    });
    console.log(`Util.s3PreSignedUrl: ${s3ObjectKey} URL ${s3PreSignedUrl}`);
    return s3PreSignedUrl;

}

function getJstNow() {
    return new Date(Date.now() + ((new Date().getTimezoneOffset() + (9 * 60)) * 60 * 1000));
}

function dayOfWeekStrToNum(dayOfWeekStr) {
    const str2num = {
        '月曜': 1,
        '火曜': 2,
        '水曜': 3,
        '木曜': 4,
        '金曜': 5,
        '土曜': 6,
        '日曜': 0,
        '土日': null,
        '週末': null,
        '平日': 1,
    };
    const regex = new RegExp(Object.keys(str2num).join('|'));
    const match = dayOfWeekStr.match(regex);
    return str2num[match[0]] || null;
}

// https://mebee.info/2022/11/01/post-84297/
function getDateFromDayOfWeek(dayOfWeek) {
    const today = getJstNow();
    return new Date(today.setDate(today.getDate() - today.getDay() + dayOfWeek));
}

function dateToTimeJaStr(d) {
    const h = dateFns.format(d, "HH", { locale: dateFnsLocaleJa });
    const m = dateFns.format(d, "mm", { locale: dateFnsLocaleJa });
    return `${h}時${m}分`
}

module.exports = {
    getS3PreSignedUrl,
    getJstNow,
    dayOfWeekStrToNum,
    getDateFromDayOfWeek,
    dateToTimeJaStr,
};