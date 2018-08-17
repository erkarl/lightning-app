const { exec } = require('child_process');
const packageJson = require('./package.json');
const GITHUB_API_ENDPOINT =
  'https://api.github.com/repos/lightninglabs/lightning-app/releases';

const executeCommand = cmd => {
  return new Promise((resolve, reject) => {
    exec(
      cmd,
      (error, stdout) => (error ? reject(error) : resolve(stdout.trim()))
    );
  });
};

const getCurrentDraftReleaseByTagName = async tagName => {
  const getAllReleaseCmd = `curl \
    -H "Content-Type: application/json" \
    -H "Authorization: token ${process.env.GH_TOKEN}" \
    ${GITHUB_API_ENDPOINT}`;
  const allReleases = await executeCommand(getAllReleaseCmd);
  const currentRelease = JSON.parse(allReleases).find(
    release => release.tag_name === tagName
  );
  if (!currentRelease)
    throw new Error(`Current release for tag ${tagName} not found.`);
  return currentRelease;
};

const updateRelease = ({ existingRelease, releaseNotes }) => {
  const updatedRelease = {
    tag_name: existingRelease.tag_name,
    target_commitish: existingRelease.target_commitish,
    name: existingRelease.name,
    body: existingRelease.body.concat(`\n# Release Notes\n${releaseNotes}`),
    draft: true,
    prerelease: false,
  };
  const UPDATE_API_ENDPOINT = `${GITHUB_API_ENDPOINT}/${existingRelease.id}`;
  const updateReleaseCmd = `curl \
    -H "Content-Type: application/json" \
    -H "Authorization: token ${process.env.GH_TOKEN}" \
    -X PATCH \
    -d '${JSON.stringify(updatedRelease)}' \
    ${UPDATE_API_ENDPOINT}`;
  return executeCommand(updateReleaseCmd);
};

const updateReleaseNotesDraft = async () => {
  try {
    if (!process.env.GH_TOKEN)
      throw new Error('Missing environment variable GH_TOKEN.');
    const currentTag = `v${packageJson.version}`;
    const getPreviousTagCmd =
      'git describe --tags --abbrev=0 $(git rev-list --tags --skip=1 --max-count=1)';
    const previousTag = await executeCommand(getPreviousTagCmd);
    const releaseNoteMarkdownFormat =
      "'* %b [%h](http://github.com/lightninglabs/lightning-app/commit/%H)\n'";
    const getReleaseNotesMarkdownCmd = `git log ${previousTag}..HEAD --merges --pretty=${releaseNoteMarkdownFormat}`;
    const releaseNotes = await executeCommand(getReleaseNotesMarkdownCmd);
    const existingRelease = await getCurrentDraftReleaseByTagName(currentTag);
    const updatedRelease = await updateRelease({
      existingRelease,
      releaseNotes,
    });
    console.log(
      `
        Release notes appended to Github release ${packageJson.version}.
        URL: ${JSON.parse(updatedRelease).html_url}
      `
    );
  } catch (e) {
    console.error(e);
  }
};

updateReleaseNotesDraft();
