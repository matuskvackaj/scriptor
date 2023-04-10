#!/bin/bash

while getopts ":c:d:s:" opt; do
  case ${opt} in
    c )
      container=${OPTARG}
      ;;
    d )
      dir=${OPTARG}
      ;;
    s )
      scriptPath=${OPTARG}
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
shift $((OPTIND -1))

if [[ -z $container || -z $dir || -z $scriptPath ]]; then
  echo "Usage: $0 -c <container name> -d <directory with archives> -s <absolute path of the script>" >&2
  exit 1
fi

#test if the parameter is a directory
if [ ! -d "$dir" ]; then
  echo "Directory does not exist: $dir"
  exit 1
fi

#unify the path format, so it ends with '/'
if [[ ${dir: -1} != "/" ]]; then
  dir+='/'
fi

#echo "$dir"temp
tempdir="$dir"results
mkdir -p $tempdir

#unpacks all .zip archives to the results folder
for archive in $dir*.zip; do
  #echo "$archive"
  unzip $archive -d $tempdir
done

for subdir in "$tempdir"/*; do
  echo "Processing subdir: $subdir"
  id=$(echo "$subdir" | grep -oE '[^/]+$')
  #pageUrl=$(awk -v search="$id" '$1 == search {print $4}' "./sites-and-pages.txt")

  echo "id: $id pageUrl: $pageUrl"
  if [ -d "$subdir" ]; then
    for archive in "$subdir"/*.gz; do
      echo "Subdir: $subdir archive: $archive"
      gunzip $archive
      subdirAbsPath=$(readlink -f "$subdir")
      archiveAbsPath=$(readlink -f "$archive")
      dirAbsPath=$(readlink -f "$dir")
      counter=0
      awk -v search="$id" '$3 == search {print $4}' "./sites-and-pages.txt" | while read -r pageUrl; do
        echo "$counter"
        echo "script: $scriptPath"
        echo "output_path: $subdirAbsPath/output"
        echo "input: $subdirAbsPath"
        echo "container: $container"
        echo "pageUrl: $pageUrl"
        echo "archive: $archive"
        echo "archiveAbsPath: $archiveAbsPath"
        echo "dirAbsPath: $dirAbsPath"
        echo "counter: $counter"
        docker run -i --rm --volume $scriptPath:/script:ro --volume $dirAbsPath/output$counter:/output --volume $subdirAbsPath:/input:ro  $container --input "{\"snapshot\": true, \"images\": false, \"keepBrowser\": false, \"url\": \"$pageUrl\"}" --replay --warc-input /input
        mv $dirAbsPath/output$counter $subdirAbsPath
        ((counter=counter+1))
      done


    done
  fi
done