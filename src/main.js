import nodeFetch from 'node-fetch'
import fetchCookie from 'fetch-cookie'
import jsdom from 'jsdom'
import RSAUtils from './RSAUtils.js'
import fs from 'fs'
import cron from 'node-cron'

const LoginRedirectToReportURL =
    "https://zjuam.zju.edu.cn/cas/login?service=https%3A%2F%2Fhealthreport.zju.edu.cn%2Fa_zju%2Fapi%2Fsso%2Findex%3Fredirect%3Dhttps%253A%252F%252Fhealthreport.zju.edu.cn%252Fncov%252Fwap%252Fdefault%252Findex"

const LoginPostURL =
    "https://zjuam.zju.edu.cn/cas/login?service=https%3A%2F%2Fhealthreport.zju.edu.cn%2Fa_zju%2Fapi%2Fsso%2Findex%3Fredirect%3Dhttps%253A%252F%252Fhealthreport.zju.edu.cn%252Fncov%252Fwap%252Fdefault%252Findex"

const ReportURL = "https://healthreport.zju.edu.cn/ncov/wap/default/index"

const SubmitURL = "https://healthreport.zju.edu.cn/ncov/wap/default/save"

const PubkeyURL = "https://zjuam.zju.edu.cn/cas/v2/getPubKey"

async function prepareFetch(username, password) {
    const cookieJar = new fetchCookie.toughCookie.CookieJar()
    const fetch = fetchCookie(nodeFetch, cookieJar)
    const loginPage = await fetch(LoginRedirectToReportURL)
    const dom = new jsdom.JSDOM(await loginPage.text())
    const execution = dom.window.document.querySelector("[name=execution]")["value"]
    const getPubKey = await fetch(PubkeyURL)
    const pubkeyInfo = await getPubKey.json()
    const key = new RSAUtils.getKeyPair(pubkeyInfo['exponent'], "", pubkeyInfo['modulus'])
    const reversedPwd = password.split("").reverse().join("")
    const encrypedPwd = RSAUtils.encryptedString(key, reversedPwd)
    const params = new URLSearchParams()
    params.append('username', username)
    params.append('password', encrypedPwd)
    params.append('authcode', '')
    params.append('execution', execution)
    params.append('_eventId', "submit")
    const response = await fetch(LoginPostURL, {
        method: "POST",
        body: params,
        // redirect: 'manual',
    })
    // Ok, now we have the cookies needed to submit the form
    return fetch
}

async function getInfo(fetch, info) {
    const reportPage = await fetch(ReportURL)
    const text = await reportPage.text()
    let oldInfo = JSON.parse(text.match(/oldInfo: ({.+}),/)[1])
    info.id = oldInfo.id
    info.uid = oldInfo.uid
    const realname = text.match(/realname: "([^\"]+)",/)[1]
    const number = text.match(/number: '([^\']+)',/)[1]
    info['name'] = realname
    info['number'] = number
    const date = new Date()
    const year = date.getFullYear()
    const month = ("0" + (date.getMonth() + 1)).slice(-2)
    const day = ("0" + date.getDate()).slice(-2)
    info['date'] = `${year}${month}${day}` //YYYYMMDD
    info['created'] = `${Math.floor(Date.now() / 1000)}`
    return info
}

async function post(fetch, info) {
    var formData = new URLSearchParams()

    for (let key in info) {
        formData.append(key, info[key])
    }
    const response = await fetch(SubmitURL, {
        method: 'POST', body: formData,
    })
    return response
}

async function run(config, oldInfo) {
    for (let account of config.account) {
        const fetch = await prepareFetch(account.username, account.password)
        console.log("Successfully login for", account.username)
        const info = await getInfo(fetch, oldInfo)
        console.log("Successfully get info for", info.name)
        const response = await post(fetch, info)

        const error = await response.json()
        if (error['e'] !== 0) {
            // There are few things we can do. Just report the error and stop.
            await report(JSON.stringify(error), config)
            if (error['m'] !== '今天已经填报了') {
                process.exit()
            }
        } else {
            report('Success!', config)
        }
    }
}

async function report(data, config) {
    const notification = config.notification

    console.log(data)

    if (notification.gotify !== undefined && notification.gotify.enabled === true) {
        nodeFetch(notification.gotify.URL, {
            method: 'POST',
            body: JSON.stringify({
                message: data,
                priority: notification.gotify.priority,
                title: notification.gotify.title,
            }),
            headers: { 'Content-Type': 'application/json' }
        })
    }

    if (notification.dingtalk !== undefined && notification.dingtalk.enabled === true) {
        nodeFetch(notification.dingtalk.URL, {
            method: 'POST',
            body: JSON.stringify({
                text: {
                    content: data
                },
                msgtype: "text",
            }),
            headers: { 'Content-Type': 'application/json' }
        })
    }

}

async function main() {
    if (fs.existsSync('./config/config.json')) {
        console.log('config.json exists, running as a self-hosted deployment')
        const config = JSON.parse(fs.readFileSync('./config/config.json'))
        const info = JSON.parse(fs.readFileSync('./config/info.json'))
        cron.schedule('0 8 * * *', () => {
            run(config, info)
        })
    } else {
        console.log('config.json not found, running as github actions or so')
        const config = {
            account: [{
                username: process.env.ZJU_USERNAME,
                password: process.env.ZJU_PASSWORD,
            }],
            notification:{}
        }
        if (process.env.GOTIFY_URL !== undefined) {
            config.notification.gotify = {
                enabled: true,
                URL: process.env.GOTIFY_URL,
                title: "Report failed",
                priority: 5
            }
        }
        if (process.env.DINGTALK_URL !== undefined) {
            config.notification.dingtalk = {
                enabled:true,
                URL: process.env.DINGTALK_URL
            }
        }
        const info = JSON.parse(fs.readFileSync('./config/info.json.example'))
        run(config, info)
    }
}

main()