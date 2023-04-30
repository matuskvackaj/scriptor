#!/bin/bash
CONTAINER="scriptor_fitlayout"
SCRIPT_PATH="../scripts/Fitlayout"
INPUT_DIR="./"


# set default values for optional arguments
s=false
i=false
k=false

# parse arguments
while getopts "ho:siku:wr:" opt; do
  case ${opt} in
    h )
      echo "Usage: $(basename $0) [-h] -o <directory> [-s] [-i] [-k] (-w <string> OR -r <string>)"
      exit 0
      ;;
    o )
      outputDirectory=$OPTARG
      ;;
    s )
      s=true
      ;;
    i )
      i=true
      ;;
    k )
      k=true
      ;;
    u )
      url=$OPTARG
      ;;
    w )
      w=true
      ;;
    r )
      r=$OPTARG
      ;;
    \? )
      echo "Invalid option: -$OPTARG" 1>&2
      exit 1
      ;;
    : )
      echo "Option -$OPTARG requires an argument." 1>&2
      exit 1
      ;;
  esac
done

# check if mandatory argument is set
if [ -z "$outputDirectory" ] || [ -z "$url" ] ; then
  echo "Error: -o <output directory> and -u <url> are mandatory arguments." >&2
  exit 1
fi

#check if one of -w or -r is set
if [ -z "$w" ] && [ -z "$r" ]; then
  echo "Error: either -w or -r <archive directory> must be set." >&2
  exit 1
fi

#check if both -w and -r are set
if [ ! -z "$w" ] && [ ! -z "$r" ]; then
  echo "Error: only one of -w <string> or -r <string> can be set." >&2
  exit 1
fi

#Program execution
echo "outputDirectory: $outputDirectory"
echo "S: $s"
echo "I: $i"
echo "K: $k"
echo "url: $url"
if [ ! -z "$w" ]; then
  echo "W: $w"
fi
if [ ! -z "$r" ]; then
  echo "R: $r"
fi

#convert paths to absolute paths
scriptAbsolutePath=$(readlink -f "$SCRIPT_PATH")
inputDirAbsolutePath=$(readlink -f "$INPUT_DIR")

if [ "${outputDirectory:0:1}" != "/" ]; then
    outputDirectory=$(readlink -f "$outputDirectory")
    echo "modded dir: $outputDirectory"
fi

#executing program for recording an archive
if [ ! -z "$w" ]; then
    docker run -i --rm --volume $scriptAbsolutePath:/script:ro --volume $outputDirectory:/output $CONTAINER --input "{\"snapshot\": $s, \"images\": $i, \"keepBrowser\": $k, \"url\": \"$url\"}"
#executing program for replaying an archive ("read")
else
    archiveAbsolutePath=$(readlink -f "$r")
    docker run -i --rm --volume $scriptAbsolutePath:/script:ro --volume $outputDirectory:/output --volume $archiveAbsolutePath:/input:ro  $CONTAINER --input "{\"snapshot\": $s, \"images\": $i, \"keepBrowser\": $k, \"url\": \"$url\"}" --replay --warc-input /input
fi