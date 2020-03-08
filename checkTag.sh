#!/usr/bin/env bash
VERSION=`node -p "require('./package.json').version"`
GIT_TAG=`git describe --exact-match --tags HEAD`


if [ "$VERSION" != "$GIT_TAG" ]; then
    echo "Current commit's tag ($GIT_TAG) does not match package version, add a git tag to this commit: $VERSION\n"
    echo "You may need to manually re-run this pipline after adding the tag\n"
    echo "To add a tag run: git tag $VERSION && git push origin --tags"
exit 1
fi

