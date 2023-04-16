#!/bin/sh

CUR_DIR=
get_cur_dir() {
    # Get the fully qualified path to the script
    case $0 in
        /*)
            SCRIPT="$0"
            ;;
        *)
            PWD_DIR=$(pwd);
            SCRIPT="${PWD_DIR}/$0"
            ;;
    esac
    # Resolve the true real path without any sym links.
    CHANGED=true
    while [ "X$CHANGED" != "X" ]
    do
        # Change spaces to ":" so the tokens can be parsed.
        SAFESCRIPT=`echo $SCRIPT | sed -e 's; ;:;g'`
        # Get the real path to this script, resolving any symbolic links
        TOKENS=`echo $SAFESCRIPT | sed -e 's;/; ;g'`
        REALPATH=
        for C in $TOKENS; do
            # Change any ":" in the token back to a space.
            C=`echo $C | sed -e 's;:; ;g'`
            REALPATH="$REALPATH/$C"
            # If REALPATH is a sym link, resolve it.  Loop for nested links.
            while [ -h "$REALPATH" ] ; do
                LS="`ls -ld "$REALPATH"`"
                LINK="`expr "$LS" : '.*-> \(.*\)$'`"
                if expr "$LINK" : '/.*' > /dev/null; then
                    # LINK is absolute.
                    REALPATH="$LINK"
                else
                    # LINK is relative.
                    REALPATH="`dirname "$REALPATH"`""/$LINK"
                fi
            done
        done

        if [ "$REALPATH" = "$SCRIPT" ]
        then
            CHANGED=""
        else
            SCRIPT="$REALPATH"
        fi
    done
    # Change the current directory to the location of the script
    CUR_DIR=$(dirname "${REALPATH}")
}

get_cur_dir
PROTO_DIR=$(dirname "${CUR_DIR}")
PROTO_SRC_DIR=$PROTO_DIR/v1

GEN_DIR=$PROTO_DIR/gen
GEN_DIR_CPP=$GEN_DIR/cpp
GEN_DIR_JAVA=$GEN_DIR/java
GEN_DIR_TS=$GEN_DIR/ts
GEN_DIR_CPP_ACTIONS=$GEN_DIR/cpp/actions
GEN_DIR_CPP_ACTIONS_CMD=$GEN_DIR/cpp/actions_cmd
GEN_DIR_CPP_TEST=$GEN_DIR/cpp/test

PBJS_PATH=minipbjs

echo "[current tool] : ",$CUR_DIR
echo "[proto]        : ",$PROTO_DIR
echo "[proto src]    : ",$PROTO_SRC_DIR
echo "[gen]          : ",$GEN_DIR

rm -rf $GEN_DIR
#C++
mkdir -p $GEN_DIR_CPP
mkdir -p $GEN_DIR_CPP_ACTIONS
mkdir -p $GEN_DIR_CPP_ACTIONS_CMD
mkdir -p $GEN_DIR_CPP_TEST
protoc -I=$PROTO_SRC_DIR --cpp_out=$GEN_DIR_CPP $PROTO_SRC_DIR/*.proto
echo "> [cpp] gen ok!"

#JAVA
mkdir -p $GEN_DIR_JAVA
protoc -I=$PROTO_SRC_DIR --java_out=$GEN_DIR_JAVA $PROTO_SRC_DIR/*.proto
echo "> [cpp] gen ok!"


#JAVA
mkdir -p $GEN_DIR_JAVA
protoc -I=$PROTO_SRC_DIR --java_out=$GEN_DIR_JAVA $PROTO_SRC_DIR/*.proto
echo "> [java] gen ok!"

#
#TS
mkdir -p $GEN_DIR_TS

$PBJS_PATH  --keep-case --path $PROTO_SRC_DIR/  --out $GEN_DIR_TS \
  --out-cpp-command-dir $GEN_DIR_CPP_ACTIONS_CMD \
  --write-action-if-exists off --name protobuf --out-cpp $GEN_DIR_CPP_ACTIONS --out-cpp-test $GEN_DIR_CPP_TEST --gen-ts on --pb-dir $PROTO_SRC_DIR

sh $CUR_DIR/sync.sh
