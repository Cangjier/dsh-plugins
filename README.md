# dsh-plugins

[DeepSeek Harness](https://github.com/Cangjier) 的插件集合，用 **git submodule** 把每个插件仓库聚合到一个入口。

每个插件仍然是独立仓库：可以单独 clone、单独开 issue、单独发版。这里只是把它们钉在一起，
让你 `clone` 一次就拿到全部，并且能一眼看出各自停在哪个 commit。

## 包含的插件

| 目录 | 插件 | 做什么 |
| --- | --- | --- |
| [`dsh-computer-use/`](dsh-computer-use) | dsh-computer-use | 把屏幕、鼠标、键盘与屏幕文字定位变成一等工具。插件只做确定性动作（看、点、打字、找字），判断全部归 DSH。仅 Windows。 |
| [`dsh-mail-notify/`](dsh-mail-notify) | dsh-mail-notify | 把 agent 的每一轮回答和你的邮箱接起来，双向：结束时发通知邮件，回复邮件又能起一轮新对话。 |
| [`dsh-ocr/`](dsh-ocr) | dsh-ocr | 读出图里每一行的内容、置信度与像素框；反过来也能给一段文字，返回它在图上的中心点（可直接点击）。 |
| [`dsh-video-audio/`](dsh-video-audio) | dsh-video-audio | 造声音、修声音、量声音。只做「同输入必得同输出」的事，且只报数字、不出判断。 |

## 快速开始

```sh
git clone --recurse-submodules https://github.com/Cangjier/dsh-plugins.git
```

Windows 上也可以直接用附带的脚本（效果一样，省得记参数）：

```powershell
./clone.ps1
```

```sh
./clone.sh
```

## 让 clone / pull 永久自动

`git clone` 默认**不会**递归子模块——这是 git 的设计，而且仓库这边没有任何办法强制它：
能决定这件事的 `clone.recurseSubmodules` / `submodule.recurse` 只存在于**本机 config**，
没法跟着仓库发出去。所以想「以后随便怎么 clone / pull 都全拉下来」，在本机各敲一次：

```sh
git config --global clone.recurseSubmodules true
git config --global submodule.recurse true
```

- `clone.recurseSubmodules true` —— 以后 `git clone` 不用带 `--recurse-submodules`，子模块自动拉全。
- `submodule.recurse true` —— 以后 `git pull`（以及 `checkout` / `switch`）自动把子模块更新到父仓库钉住的 commit。

撤销：

```sh
git config --global --unset clone.recurseSubmodules
git config --global --unset submodule.recurse
```

只想对这一个仓库生效，就把上面的 `--global` 去掉，在仓库里跑。

### 已经 clone 了，但插件目录是空的

这是漏了 `--recurse-submodules` 的正常现象。补一条就行：

```sh
git submodule update --init --recursive
```

## 更新到各插件的最新版

父仓库钉住的是**固定 commit**，这是有意的：同一个 commit 永远给你同一套插件，可复现。

代价是别人在插件仓库里推了新东西，这里不会自己跟——`git pull` 只会把子模块对齐到
**已经记录过**的那个 commit。要前进到各插件 `main` 的最新提交：

```sh
./sync.ps1          # 或 ./sync.sh
```

它做三件事：初始化子模块、把每个子模块快进到 `origin/main`、报告哪些插件动了。
默认只改工作区不提交，确认没问题再加 `-Commit` 提交这次 pin 变更（`./sync.sh --commit`），
最后 `git push` 才发布。

要手工一步步来，就是：

```sh
git submodule update --remote --merge
git commit -am "chore: 更新插件子模块到各自 main 最新提交"
git push
```

## 在插件里干活

子模块就是普通仓库，进去正常 `git checkout -b` / `commit` / `push` 即可。
注意它默认是 **detached HEAD**（父仓库钉的是 commit，不是分支），
所以先切到分支再改，省得提交完找不到：

```sh
cd dsh-ocr
git switch main        # 从 detached HEAD 回到分支
```

推上去之后，回到父仓库跑 `./sync.ps1 -Commit` 把 pin 跟上。

## 新增一个插件

```sh
git submodule add -b main https://github.com/Cangjier/dsh-<新插件>.git dsh-<新插件>
git commit -m "feat: 加入 dsh-<新插件>"
```

`-b main` 会写进 `.gitmodules` 的 `branch`，`sync` 脚本靠它知道该跟哪条分支。

## 说明

- `core.autocrlf=true` 的机器上，`.gitmodules` 和 `*.sh` 必须是 LF——[`.gitattributes`](.gitattributes) 已经钉住，
  免得 git 逐行解析 `.gitmodules` 时被 CRLF 弄坏。
- 子模块用的是 HTTPS 地址，clone 公开仓库不需要凭据；要往里推才需要登录。
