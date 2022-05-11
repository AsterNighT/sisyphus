import nodeFetch, { FormData as FetchFormData } from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import jsdom from 'jsdom';
import RSAUtils from './RSAUtils.js';
import fs from 'fs';
import cron from 'node-cron';

const LoginRedirectToReportURL =
    'https://zjuam.zju.edu.cn/cas/login?service=https%3A%2F%2Fhealthreport.zju.edu.cn%2Fa_zju%2Fapi%2Fsso%2Findex%3Fredirect%3Dhttps%253A%252F%252Fhealthreport.zju.edu.cn%252Fncov%252Fwap%252Fdefault%252Findex';

const LoginPostURL =
    'https://zjuam.zju.edu.cn/cas/login?service=https%3A%2F%2Fhealthreport.zju.edu.cn%2Fa_zju%2Fapi%2Fsso%2Findex%3Fredirect%3Dhttps%253A%252F%252Fhealthreport.zju.edu.cn%252Fncov%252Fwap%252Fdefault%252Findex';

const ReportURL = 'https://healthreport.zju.edu.cn/ncov/wap/default/index';

const SubmitURL = 'https://healthreport.zju.edu.cn/ncov/wap/default/save';

const VerifyCodeURL = 'https://healthreport.zju.edu.cn/ncov/wap/default/code';

const PubkeyURL = 'https://zjuam.zju.edu.cn/cas/v2/getPubKey';

const APIURL = 'http://asternight.site:9898/ocr/file/text';

let config: Config;
let fetch: Fetch;
let runType: RunType;

type Fetch = typeof nodeFetch;
type Account = {
    username: string,
    password: string
};
type Info = {
    [key: string]: string
};
type SubmitResult = {
    e: number,
    m: string,
    d: unknown,
};

type Config = {
    account: Account[],
    notification: {
        gotify?: {
            enabled: boolean,
            URL: string,
            title: string,
            priority: number
        },
        dingtalk?: {
            enabled: boolean,
            URL: string,
        }
    }
};

enum RunType {
    Local,
    Workflow,
    Debug
}

async function report(data: any): Promise<void> {
    const notification = config.notification;

    console.log(data);

    if (notification.gotify?.enabled) {
        nodeFetch(notification.gotify.URL, {
            method: 'POST',
            body: JSON.stringify({
                message: data,
                priority: notification.gotify.priority,
                title: notification.gotify.title,
            }),
            headers: { 'Content-Type': 'application/json' },
        });
    }

    if (notification.dingtalk?.enabled) {
        nodeFetch(notification.dingtalk.URL, {
            method: 'POST',
            body: JSON.stringify({
                text: {
                    content: data,
                },
                msgtype: 'text',
            }),
            headers: { 'Content-Type': 'application/json' },
        });
    }
}

function reportFatal(info = ''): never {
    report(`Error occurs in code: ${info} \n At ${new Error().stack}`);
    process.exit(1);
}

function reportLocal(...log: any[]): void {
    if (runType === RunType.Local || runType === RunType.Debug) console.log(...log);
}

async function getVerifyCode(image: Blob): Promise<string> {
    const formData = new FetchFormData();
    formData.set('image', image);
    const ocrResult = await fetch(APIURL, {
        method: 'POST',
        body: formData,
    });
    return ocrResult.text();
}

async function prepareFetch(username: string, password: string) {
    fetch = fetchCookie(nodeFetch, new fetchCookie.toughCookie.CookieJar());
    const loginPage = await fetch(LoginRedirectToReportURL);
    const dom = new jsdom.JSDOM(await loginPage.text());
    const executionDom = dom.window.document.querySelector('[name=execution]');
    if (executionDom === null) reportFatal('Login page changed');
    const execution = (executionDom as any)['value'] as string;
    const getPubKey = await fetch(PubkeyURL);
    const pubkeyInfo: any = await getPubKey.json();
    const key = RSAUtils.getKeyPair(pubkeyInfo.exponent, '', pubkeyInfo.modulus);
    const reversedPwd = password.split('').reverse().join('');
    const encryptedPwd = RSAUtils.encryptedString(key, reversedPwd);
    const params = new URLSearchParams();
    params.append('username', username);
    params.append('password', encryptedPwd);
    params.append('authcode', '');
    params.append('execution', execution);
    params.append('_eventId', 'submit');
    await fetch(LoginPostURL, {
        method: 'POST',
        body: params,
        // redirect: 'manual',
    });
    // Ok, now we have the cookies needed to submit the form
    return fetch;
}

async function getInfo(info: Info) {
    const reportPage = await fetch(ReportURL);
    const text = await reportPage.text();
    const oldInfo = JSON.parse((text.match(/oldInfo: ({.+}),/) || reportFatal('Info format changed'))[1]);
    info.id = oldInfo.id;
    info.uid = oldInfo.uid;
    const realname = (text.match(/realname: "([^"]+)",/) || reportFatal('Realname format changed'))[1];
    const number = (text.match(/number: '([^']+)',/) || reportFatal('Number format changed'))[1];
    info.name = realname;
    info.number = number;

    const date = new Date();
    const year = date.getFullYear();
    const month = ('0' + (date.getMonth() + 1)).slice(-2);
    const day = ('0' + date.getDate()).slice(-2);
    info.date = `${year}${month}${day}`; //YYYYMMDD
    info.created = `${Math.floor(Date.now() / 1000)}`;

    // Verify code
    for (; ;) {
        const codeImageResponse = await fetch(VerifyCodeURL);
        const verifyCode = await getVerifyCode(await codeImageResponse.blob());

        // Remove those obvious errors
        if (/^[a-zA-Z]{4}$/.test(verifyCode)) {
            info.verifyCode = verifyCode;
            console.log(info.verifyCode);
            break;
        }
    }
    return info;
}

async function postInfo(info: Info) {
    const formData = new URLSearchParams();

    for (const key in info) {
        formData.append(key, info[key]);
    }
    const response = await fetch(SubmitURL, {
        method: 'POST', body: formData,
    });
    return response;
}

async function trySubmit(account: Account, oldInfo: Info): Promise<SubmitResult> {
    await prepareFetch(account.username, account.password);
    reportLocal('Successfully login for', account.username);
    const info = await getInfo(oldInfo);
    reportLocal('Successfully get info for', info.name);
    const response = await postInfo(info);

    return response.json() as Promise<SubmitResult>;
}

async function run(oldInfo: Info) {
    for (const account of config.account) {
        let tries = 0;
        const MaxTries = 5;
        for (tries = 0; tries < MaxTries; tries++) {
            const error: SubmitResult = await trySubmit(account, oldInfo);
            if (error.e !== 0) {
                // There are few things we can do. Report the error is always a good idea.
                await report(JSON.stringify(error));
                if (error.m === '今天已经填报了') {
                    // This is ok.
                    break;
                }
                if (error.m === '验证码错误') {
                    // This is possible, give it another few tries.
                    continue;
                }
                // We do not know the error. Fail the github workflow, so that repo keeper would get an email.
                process.exit(1);
            } else {
                report('Success!');
                break;
            }
        }
        // Somehow we failed in a recoverable error even after MaxTries. It could be bad luck, or something else.
        if (tries === MaxTries) {
            await report('Retries failed. Check logs for more information');
            process.exit(1);
        }
    }
}

function determineRunType() {
    if (process.env.DEBUG) return RunType.Debug;
    if (fs.existsSync('./config/config.json')) return RunType.Local;
    else return RunType.Workflow;
}

function getConfigFromEnv() {
    const usernameArray = (process.env.ZJU_USERNAME || reportFatal('ZJU_USERNAME not set')).split(",").map(s => s.trim());
    const passwordArray = (process.env.ZJU_PASSWORD || reportFatal('ZJU_PASSWORD not set')).split(",").map(s => s.trim());

    if (usernameArray.length !== passwordArray.length) {
        console.error("username and password length mismatch");
    }
    const accountArray = usernameArray.map((username,i) => ({username, password: passwordArray[i]});
    for (let i = 0; i < usernameArray.length; i++) {
        accountArray.push({
            username: usernameArray[i],
            password: passwordArray[i],
        });
    }

    config = {
        account: accountArray,
        notification: {},
    };
    if (process.env.GOTIFY_URL) {
        config.notification.gotify = {
            enabled: true,
            URL: process.env.GOTIFY_URL,
            title: 'Report failed',
            priority: 5,
        };
    }
    if (process.env.DINGTALK_URL) {
        config.notification.dingtalk = {
            enabled: true,
            URL: process.env.DINGTALK_URL,
        };
    }
}

async function main() {
    runType = determineRunType();
    if (runType === RunType.Local) {
        console.log('config.json exists, running as a self-hosted deployment');
        config = JSON.parse(fs.readFileSync('./config/config.json').toString());
        const info = JSON.parse(fs.readFileSync('./config/info.json').toString());
        run(info);
        cron.schedule('0 8 * * *', () => {
            try {
                run(info);
            } catch (error) {
                report(error);
                process.exit(1);
            }
        });
    }
    if (runType === RunType.Workflow) {
        console.log('config.json not found, running as github actions or so');
        getConfigFromEnv();
        const info = JSON.parse(fs.readFileSync('./config/info.json.example').toString());
        try {
            run(info);
        } catch (error) {
            report(error);
            process.exit(1);
        }
    }
    if (runType === RunType.Debug) {
        console.log('Running in debug mode');
        const info = JSON.parse(fs.readFileSync('./config/info.json.example').toString());
        run(info);
    }
}

main();