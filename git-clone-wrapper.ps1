# git clone 自动递归子模块 —— 可直接 dot-source，也可整段粘进 $PROFILE
#
#   . .\git-clone-wrapper.ps1
#
# 效果：普通的 git clone <url> 会自动带上 --recurse-submodules；同时用 -c 把
# submodule.recurse=true 写进「新仓库自己的」.git/config，于是这个仓库以后
# git pull 也会自动更新子模块。其他子命令（status/log/diff/push/...）原样转发。
#
# 为什么需要它：git 自身没有开关能让 clone 自动递归子模块——
#   - submodule.recurse 明确不覆盖 clone（git-config 文档写死的）
#   - clone.recurseSubmodules 这个变量根本不存在
#   - alias 也盖不住内建命令
#
# 隔离性：什么都不写进全局配置，也不动任何已有仓库；-c 只作用于新克隆出来的
# 那一个仓库。不想要了就删掉这个文件（或 $PROFILE 里对应的那段）。
#
# 行为规则（避免和你显式写的参数打架）：
#   git clone <url>                          两个都加
#   git clone --recurse-submodules <url>     只加 -c（你已经说了要递归）
#   git clone --no-recurse-submodules <url>  什么都不加（尊重你的意思）
#   自己写了 submodule.recurse=...           不覆盖你的
$__dshGit = (Get-Command git.exe -CommandType Application -ErrorAction SilentlyContinue).Source

if ($__dshGit) {
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
            if ($mode -ne 'off' -and -not $hasOwnConfig) { $extra += @('-c', 'submodule.recurse=true') }

            & $__dshGit clone @extra @rest
            return
        }
        & $__dshGit @a
    }
}