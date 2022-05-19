# sisyphus
一个用于打卡的小玩意

## 声明
本人遗失此段代码，并且本人不同意这段代码的所作所为。使用者应当自行负责。本代码仅供节约时间使用，不可用于虚报打卡位置。

## 如何使用
注意，如果这个 Repo 更新了，你需要同样更新你的 Fork 和本地部署。

### Github Actions
Fork 这个 Repo，在 `Settings - Secrets - Actions` 中新建 `ZJU_PASSWORD`，`ZJU_USERNAME` 两个 Secret，并设置为你的统一认证密码和学号。
<!-- 你可以在 `.github/workflows/actions.yml` 中设置具体的打卡时间，格式为 [cron](https://crontab.guru/)。注意 Github workflow 使用 UTC+0 时间，而我们这儿是 UTC+8， 所以你可能会想要在实际时间的基础上提前8小时。 -->

你可以通过在Sercet中使用`","`间隔符来为多个账号打卡，例如`ZJU_USERNAME = "3010100001,3010100002,3010100003"`，`ZJU_PASSWORD = "passwd1,passwd2,passwd3"`。

默认的打卡时间是北京时间凌晨0点，但是你可以通过设置Environments来自定义打卡时间，即在每日0点整触发Actions后，会有一个额外的延时，且时长可以自定义。方法如下：运行完一次Actions之后，在Settings -> Environments中会自动多出一个名为Sisyphus_Env的环境（也可以自己手动添加），修改其中的变量`Wait timer`为你需要的延时时长（单位为分钟）然后点击"Save protection rules"。例如你需要设置每天凌晨4点打卡，只需要将这个值设置为240。

### Local Deployment
``` bash
cp config/config.json.example config/config.json
# modify config/config.json
cp config/info.json.example config/info.json
npm install
npm run fire
```
脚本通过判断 `config/config.json` 是否存在决定使用本地配置文件还是环境变量。所以如果你想要用 `config.json`，就要用一整套。
你可能会想要使用 `systemd`、`supervisord`、`pm2` 一类的东西来管理它。

### Docker Deployment
我还没有写，contributions are welcomed.

## 通知
你可以通过查看 Github Actions log 的方式来监控运行状态，不过这显然很麻烦。如果打卡失败了，理论上来说你会收到一封邮件提示你 `pipeline failed`。
目前支持的通知有：
- Gotify
- 钉钉机器人（极其玄学，能不能收到全靠运气。你可以把关键词设置为 `e`。）

你可以在 `config.json` 中修改通知对应的 URL。部署在 Github Actions 上的话，可以在 secrets 中设置对应的 `<SERVICENAME>_URL`。例如 `GOTIFY_URL` 和 `DINGTALK_URL`。

## What to contribute

如果打卡挂了，你可以抓包后尝试更新 `info.json.example` 文件，然后交一个 PR。使用 Chrome 开发者工具调试你的手机即可。

可以支持更多的通知手段，contributions are welcomed.