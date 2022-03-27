# sisyphus
一个用于打卡的小玩意

## 如何使用
### Github Actions
Fork 这个 Repo，在 `Settings - Secrets - Actions` 中新建 `ZJU_PASSWORD`，`ZJU_USERNAME` 两个 Secret，并设置为你的统一认证密码和学号。

### Local Deployment
``` bash
cp config.json.example config.json
# modify config.json
cp info.json.example info.json
npm install
npm run fire
```
脚本通过判断 `config.json` 是否存在决定使用本地配置文件还是环境变量。所以如果你想要用 `config.json`，就要用一整套。
你可能会想要使用 `systemd`、`supervisord`、`pm2` 一类的东西来管理它。

### Docker Deployment
我还没有写，contributions are welcomed.

## 通知
你可以通过查看 Github Actions log 的方式来监控运行状态，不过这显然很麻烦。
目前支持的通知有：
- Gotify
- 钉钉机器人

你可以在 `config.json` 中修改通知对应的 URL。部署在 Github Actions 上的话，可以在 secrets 中设置对应的 `<SERVICENAME>_URL`。例如 `GOTIFY_URL` 和 `DINGTALK_URL`。

## What to contribute

如果打卡挂了，你可以抓包后尝试更新 `info.json.example` 文件，然后交一个 PR。

可以支持更多的通知手段，contributions are welcomed.
