# dsh-plugins

DeepSeek Harness 插件集合，用 **git submodule** 把每个插件仓库聚合到一个入口。

每个插件仍然是独立仓库：可以单独 clone、单独开 issue、单独发版。这里只是把它们钉在一起，
让你 `clone` 一次就拿到全部，并且能一眼看出各自停在哪个 commit。

## 包含的插件

| 目录 | 插件 | 做什么 |
| --- | --- | --- |
| [`dsh-computer-use/`](dsh-computer-use) | dsh-computer-use | 把屏幕、鼠标、键盘与屏幕文字定位变成一等工具。插件只做确定性动作（看、点、打字、找字），判断全部归 DSH。仅 Windows。 |
| [`dsh-mail-notify/`](dsh-mail-notify) | dsh-mail-notify | 把 agent 的每一轮回答和你的邮箱接起来，双向：结束时发通知邮件，回复邮件又能起一轮新对话。 |
| [`dsh-ocr/`](dsh-ocr) | dsh-ocr | 读出图里每一行的内容、置信度与像素框；反过来也能给一段文字，返回它在图上的中心点（可直接点击）。 |
| [`dsh-video-audio/`](dsh-video-audio) | dsh-video-audio | 造声音、修声音、量声音。只做「同输入必得同输出」的事，且只报数字、不出判断。 |
| [`video-factory/`](video-factory) | video-factory | 素材进，成片出。把图片、视频片段、音乐和一段文案变成一条能直接发布的 mp4；同样只提供确定性工具，流程与创作决策归 DSH。 |

前四个是 `dsh-` 前缀的独立插件；`video-factory` 名字没有前缀，但同样是 DSH 插件，一并收在这里。

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

## 让 pull 自动更新子模块（只影响这一个仓库）

`git pull` 可以做到完全不用管子模块，在本仓库里敲一次：

```sh
cd dsh-plugins
git config submodule.recurse true      # 注意：没有 --global
```

**去掉 `--global` 是关键**：这条只写进 `dsh-plugins/.git/config`，本机其他仓库一律不受影响——
包括那些自己带子模块、而你并不希望它递归的仓库。可以这样确认：

```sh
git config --get submodule.recurse                        # 在 dsh-plugins 里：true
git -C ../某个别的仓库 config --get submodule.recurse     # 空
```

之后 `git pull` 会自动带上 `--recurse-submodules`：先把子模块缺的 commit 取回来，
再把工作区对齐到父仓库钉住的那个 commit。`checkout` / `switch` / `fetch` / `reset` /
`restore` / `grep` / `push` 也一并生效。

代价是它写在 `.git/config` 里、不进版本控制，所以**重新 clone 一次就得再设一次**。
（用上面的 `clone.ps1` / `clone.sh` 克隆，内容天然是拉全的，只是后续的 `pull` 仍需要这条设置。）

如果嫌每次都要重设，看下面[第 4 招](#让-clone-也自动git-没给这个开关)：在 shell 里包一层 `git`，
克隆时用 `-c` 自动把这条写进新仓库——同样是仓库局部、同样不碰全局，但不用再手动敲。

撤销：

```sh
git config --unset submodule.recurse
```

如果你确实想让本机**所有**仓库都自动递归，那才用全局形式
`git config --global submodule.recurse true`——它会作用到每一个带子模块的仓库，请自行权衡。

## 让 clone 也自动：git 没给这个开关

`git clone` 默认不递归子模块，而且**没有任何配置能改变这一点**。这不是本仓库偷懒，
是 git 明确的设计——[`git-config` 文档](https://git-scm.com/docs/git-config#Documentation/git-config.txt-submodulerecurse)
列了受 `submodule.recurse` 影响的命令，并直接写明：

> `checkout, fetch, grep, pull, push, read-tree, reset, restore` and `switch` are always
> supported. **`clone` and `ls-files` are not supported.**

顺带一提：**`clone.recurseSubmodules` 这个变量根本不存在**（git 的 config 里只有
`fetch.recurseSubmodules`、`push.recurseSubmodules`、`submodule.<name>.fetchRecurseSubmodules`
和 `submodule.recurse`），网上不少说法把它写错了。另外 alias 也盖不住内建命令——
`git config alias.clone 'clone --recurse-submodules'` 是无效的，`git clone` 仍然是内建的那个。

所以克隆方向只有三招：

**1. 带上参数**（最省事，记一次就够）

```sh
git clone --recurse-submodules https://github.com/Cangjier/dsh-plugins.git
```

**2. 用仓库自带的脚本**

```powershell
./clone.ps1
```

```sh
./clone.sh
```

**3. 给自己定个更短的命令**——PowerShell 写进 `$PROFILE`：

```powershell
function gcl { git clone --recurse-submodules @args }
```

bash / zsh 写进 `~/.bashrc`：

```sh
gcl() { git clone --recurse-submodules "$@"; }
```

以后 `gcl <url>` 就是全量克隆。

**4. 让 `git clone` 本身就自动递归**——在 shell 层面给 `git` 套一层，只改 `clone`，
其他子命令原样转发。

本仓库带了现成文件 [`git-clone-wrapper.ps1`](git-clone-wrapper.ps1)，dot-source 就能用：

```powershell
. .\git-clone-wrapper.ps1
```

想让它长期生效，把该文件的内容整段粘进 `$PROFILE`（或 `profile.ps1`）。内容如下：

```powershell
$RealGit = (Get-Command git.exe -CommandType Application).Source

function git {
    $a = @($args)
    if ($a.Count -ge 1 -and "$($a[0])" -eq 'clone') {
        $rest = if ($a.Count -gt 1) { $a[1..($a.Count - 1)] } else { @() }

        $mode = 'auto'          # auto | on | off
        $hasOwnConfig = $false
        foreach ($x in $rest) {
            if     ("$x" -match '^--no-recurse-submodules') { $mode = 'off' }
            elseif ("$x" -match '^--recurse-submodules')    { $mode = 'on'  }
            if     ("$x" -match 'submodule\.recurse')       { $hasOwnConfig = $true }
        }

        $extra = @()
        if ($mode -eq 'auto') { $extra += '--recurse-submodules' }
        # -c 把设置写进「新仓库自己的」.git/config：它以后 git pull 也会自动更新子模块。
        # 只影响新克隆出来的这一个仓库，不碰全局配置，也不动任何已有仓库。
        if ($mode -ne 'off' -and -not $hasOwnConfig) { $extra += @('-c', 'submodule.recurse=true') }

        & $RealGit clone @extra @rest
        return
    }
    & $RealGit @a
}
```

这样敲普通的 `git clone <url>` 就会自动拉全子模块，**而且新仓库之后的 `git pull` 也会自动更新子模块**
（靠 `-c` 写进它自己的 `.git/config`）。整个机制只在你自己的 shell 里生效，不写进全局配置，
也不影响任何已有仓库。bash / zsh 同理，包一层 `git()` 函数即可。

行为规则，避免和你显式写的参数打架：

| 你敲的 | 效果 |
| --- | --- |
| `git clone <url>` | 补 `--recurse-submodules`，并给新仓库设 `submodule.recurse=true` |
| `git clone --recurse-submodules <url>` | 只给新仓库设 `submodule.recurse=true` |
| `git clone --no-recurse-submodules <url>` | 什么都不加，完全按你的意思 |
| 自己写了 `submodule.recurse=...` | 不覆盖 |

bash / zsh 同理，包一层 `git()` 函数即可。这样敲普通的 `git clone <url>` 就会自动拉全，
而且只在你自己的 shell 里生效，不会写进任何仓库的 config。

### 已经 clone 了，但插件目录是空的

漏了 `--recurse-submodules` 的正常现象，补一条就行：

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

它做三件事：初始化子模块、把每个子模块快进到 `origin/main`、报告哪些插件的 pin 动了。

默认只改工作区、**不提交**；确认没问题再加 `-Commit`（bash 下是 `--commit`）提交这次 pin 变更，
最后 `git push` 才算发布。提交时**只提交子模块指针**，父仓库里别的手改和未跟踪文件不会被顺手带进去。
如果什么插件都没前进，它会直接说「没有 pin 变化」并原样退出。

要手工一步步来，就是：

```sh
git submodule update --remote --merge
git add dsh-computer-use dsh-mail-notify dsh-ocr dsh-video-audio video-factory   # 只加子模块指针
git commit -m "chore: 更新插件子模块到各自 main 最新提交"
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
git submodule add -b main https://github.com/Cangjier/<仓库名>.git <目录名>
git commit -m "feat: 加入 <仓库名>"
```

目录名不必和仓库名带同样前缀（`video-factory` 就没有 `dsh-` 前缀）。
`-b main` 会写进 `.gitmodules` 的 `branch`，`sync` 脚本靠它知道该跟哪条分支。

## 说明

- `core.autocrlf=true` 的机器上，`.gitmodules` 和 `*.sh` 必须是 LF——[`.gitattributes`](.gitattributes) 已经钉住，
  免得 git 逐行解析 `.gitmodules` 时被 CRLF 弄坏。
- 子模块用的是 HTTPS 地址，clone 公开仓库不需要凭据；要往里推才需要登录。
- **`*.ps1` 开头那个 UTF-8 BOM 是故意的，别删。** Windows PowerShell 5.1 在没有 BOM 时会按系统
  ANSI 代码页（简中机器上是 GBK）读脚本，中文注释和提示会变成乱码，严重时字符串的引号被截断、
  整个脚本解析失败。PowerShell 7 有无 BOM 都能读，所以留着 BOM 最省事。
- **`*.sh` 反过来必须是不带 BOM 的 UTF-8**，否则 shebang 前多了三个字节，`./clone.sh` 直接跑不起来。
  这也是两个 `.ps1` 和两个 `.sh` 编码不同的原因，不是疏漏。
