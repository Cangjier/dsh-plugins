#!/bin/sh
# 把所有插件子模块前进到各自远端 main 的最新提交，并记录新的 pin。
#
# 父仓库钉住的是固定 commit，所以普通的 git pull 只会把子模块对齐到「已经记录过」
# 的那个 commit——别人在插件仓库里推了新东西，这里不会自动跟。这个脚本负责「跟到最新」：
#
#   1. git submodule update --init --recursive   确保子模块都在
#   2. git submodule update --remote --merge     每个子模块快进到 origin/main
#   3. 报告哪些插件动了
#
# 默认只改工作区、不提交；加 --commit 才提交这次 pin 变更。
#
# 用法：
#   ./sync.sh
#   ./sync.sh --commit
#   ./sync.sh --commit -m "chore: 更新 dsh-ocr 到 0.3"
set -eu

cd "$(dirname "$0")"

if [ ! -e .git ]; then
    echo "这里不是 git 仓库的根目录：$(pwd)" >&2
    exit 1
fi

commit=0
msg=''
while [ $# -gt 0 ]; do
    case $1 in
        --commit) commit=1; shift ;;
        -m)       msg=$2; shift 2 ;;
        *)        echo "未知参数：$1" >&2; exit 2 ;;
    esac
done

echo '1/2 初始化并拉取子模块…'
git submodule update --init --recursive

echo '2/2 把每个子模块快进到 origin/main…'
if ! git submodule update --remote --merge; then
    echo '有子模块无法自动快进（多半是里面有未提交的改动）。' >&2
    echo '进去手动处理后重跑，或先 git -C <子模块> stash。' >&2
    exit 1
fi

if [ -z "$(git status --porcelain)" ]; then
    echo
    echo '所有插件都已经是最新，没有 pin 变化。'
    exit 0
fi

echo
echo '这些插件的 pin 变了：'
git submodule summary

if [ "$commit" -eq 0 ]; then
    echo
    echo '（尚未提交）满意就跑：./sync.sh --commit'
    exit 0
fi

[ -n "$msg" ] || msg='chore: 更新插件子模块到各自 main 最新提交'
git add --all
git commit -m "$msg"

echo
echo '已提交。别忘了 git push 才算发布：'
echo '  git push'
