#!/bin/bash
#check if parameter (directory with archives) was passed to the program
scriptPath="/home/matus/Desktop/bakalarka/scriptor/scripts/Fitlayout-Puppeteer/" #will be a param
container="scriptor_matus_2"


if [ $# -eq 0 ]; then
    echo "Please provide a directory name, where the archives are located, as an argument."
    exit 1
fi

dir="$1"

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
tempdir="$dir"temp
mkdir -p $tempdir

#unpacks all .zip archives to the temp folder
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
      #docker run  -it --rm --volume /home/matus/Desktop/bakalarka/scriptor/scripts/Fitlayout-Puppeteer/:/script:ro --volume /home/matus/Desktop/bakalarka/scriptor/bin/output20:/output --volume /home/matus/Desktop/bakalarka/scriptor/bin/:/input:ro  scriptor_matus_2 --input "{\"snapshot\": true, \"images\": false, \"keepBrowser\": false, \"url\": \"https://www.google.com\"}" --replay --warc-input "/input/output3/browserContexts/default/warcs/"
      #echo "script path: $scriptPath"
      #echo "subdir: $subdir"
      subdirAbsPath=$(readlink -f "$subdir")
      archiveAbsPath=$(readlink -f "$archive")
      dirAbsPath=$(readlink -f "$dir")
      #echo "abspath: $subdirAbsPath"
      #echo "container: $container"
      #echo "archive: $archive"
      counter=0
      awk -v search="$id" '$3 == search {print $4}' "./sites-and-pages.txt" | while read -r pageUrl; do
        echo "$counter"
        #echo "Value of the fourth column: $pageUrl"
        #we work with this line
        echo "script: $scriptPath"
        echo "output_path: $subdirAbsPath/output"
        echo "input: $subdirAbsPath"
        echo "container: $container"
        echo "pageUrl: $pageUrl"
        echo "archive: $archive"
        echo "archiveAbsPath: $archiveAbsPath"
        echo "dirAbsPath: $dirAbsPath"
        echo "$dirAbsPath$counter"
        docker run -i --rm --volume $scriptPath:/script:ro --volume $dirAbsPath/output$counter:/output --volume $subdirAbsPath:/input:ro  $container --input "{\"snapshot\": true, \"images\": false, \"keepBrowser\": false, \"url\": \"$pageUrl\"}" --replay --warc-input /input
        #docker run -i --rm --volume /home/matus/Desktop/bakalarka/scriptor/scripts/Snapshot:/script:ro --volume $dirAbsPath/output$counter:/output --volume $subdirAbsPath:/input:ro  $container --input "{\"snapshot\": false, \"images\": false, \"keepBrowser\": false, \"url\": \"$pageUrl\"}" --replay --warc-input /input
        mv $dirAbsPath/output$counter $subdirAbsPath
        ((counter=counter+1))
      done


    done
  fi
done

