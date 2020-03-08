#!/usr/bin/env bash
VERSION=`node -p "require('./package.json').version"`
GIT_TAG=`git describe --exact-match --tags HEAD`


if [ "$VERSION" != "$GIT_TAG" ]; then
    echo "Current commit's tag ($GIT_TAG) does not match package version, add a git tag to this commit: $VERSION"
exit 1
fi

