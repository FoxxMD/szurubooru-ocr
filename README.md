# szurubooru-ocr

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Use [Tesseract.js](https://tesseract.projectnaptha.com/) to automatically add notes (annotations) and existing Tags to your [Szurubooru posts](https://github.com/rr-/szurubooru) using extracted OCR text. 

# Features

* Configuration via JSON or YAML
* Highly parallel fetching of posts/images and OCR processing
* User-defined OCR confidence level
* User-configurable behavior for handling notes/tags like "add only on none existing", "overwrite", and "add new"
* User-configurable search query
* Persistent ID tracking so this can be used to only update posts not already processed


# Install

## Local

Clone this repository somewhere and then install from the working directory

```bash
git clone https://github.com/FoxxMD/szurubooru-ocr .
cd szurubooru-ocr
nvm use # optional, to set correct Node version
npm install
npm build
```
## [Docker](https://hub.docker.com/r/foxxmd/szurubooru-ocr)

```
foxxmd/szurubooru-ocr:latest
```

Or use the provided [docker-compose.yml](/docker-compose.yml) after modifying it to fit your configuration.

Recommended configuration steps for docker or docker-compose usage:

* If you must **bind a host directory into the container for storing configurations and credentials:**
    * [Using `-v` method for docker](https://docs.docker.com/storage/bind-mounts/#start-a-container-with-a-bind-mount): `-v /path/on/host/config:/config`
    * [Using docker-compose](https://docs.docker.com/compose/compose-file/compose-file-v3/#short-syntax-3): `- /path/on/host/config:/config`

### Linux Host

If you are

* using [rootless containers with Podman](https://developers.redhat.com/blog/2020/09/25/rootless-containers-with-podman-the-basics#why_podman_)
* running docker on MacOS or Windows

this **DOES NOT** apply to you.

If you are running Docker on a **Linux Host** you must specify `user:group` permissions of the user who owns the **configuration directory** on the host to avoid [docker file permission problems.](https://ikriv.com/blog/?p=4698) These can be specified using the [environmental variables **PUID** and **PGID**.](https://docs.linuxserver.io/general/understanding-puid-and-pgid)

To get the UID and GID for the current user run these commands from a terminal:

* `id -u` -- prints UID
* `id -g` -- prints GID

# Configuration

You **must** have a valid, accessible configuration file in place in order to use this application.

* For **Local** installs simply rename `PROJECT_DIR/config/config.yaml.example` to `PROJECT_DIR/config/config.yaml`
* For **Docker** make sure you have bound a directory to the container directory `/config`. The example config will be copied there. Then do the same as the Local install.

See the [Configuration README](/config/README.md) for config file explanation.

# Usage

## Local

Application outputs logs to command line.

`npm run start`

## Docker

Application outputs logs to docker logs.

`docker run -e "PUID=1000" -e "PGID=1000" -v /path/on/host/config:/config foxxmd/szurubooru-ocr`
