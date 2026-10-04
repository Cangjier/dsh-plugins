#!/bin/sh
# 克隆 dsh-plugins，并把所有插件子模块一次拉全。
#
# 等价于 git clone --recurse-submodules，只是省得记这个参数。
# 只想敲一次的话，也可以给本机做全局配置（见 README「让 clone / pull 永久自动」），
# 那样普通的 git clone / git pull 就会自己递归。
#
# 用法：./clone.sh [目标目录]
set -eu

dir=${1:-dsh-plugins}
repo=${DSH_PLUGINS_REPO:-https://github.com/Cangjier/dsh-plugins.git}

if [ -e "$dir" ]; then
    echo "目标目录已存在：$dir（换个参数，或先把旧目录移走）" >&2
    exit 1
fi

echo "克隆 $repo -> $dir（含全部子模块）…"
git clone --recurse-submodules "$repo" "$dir"

echo
echo '完成。各插件当前的 commit：'
git -C "$dir" submodule status
