<h3>Project Details:</h3>
This project automatically tests major functionalities of the Dacast platform UI. Tests are written with Playwright and can be run in parallel or sequentially. Each test is stored as a separate file in the `src` folder and is self-contained, allowing independent execution. For example, if the playlist test requires videos, they will be uploaded at the beginning of the test.

Some tests validate copy-to-clipboard functionality, using the `clipboardy` library to read clipboard data. Other tests validate video playback, which doesn't work on Chromium (likely due to a bug in the THEOplayer used by Dacast). Therefore, Chrome is used by default, although it's possible to run tests in other browsers.

So far, these tests have been validated with Chrome and Chromium only. Firefox, Edge, and Safari have not been tested.

The following tests are currently implemented:

<h3>GDPR/CCPA banner and Chat:</h3>
<ul>
<li>Navigate to the Dacast website</li>
<li>Wait for the Matomo request to be made</li>
<li>Verify that the Matomo script is present in the DOM</li>
<li>Handle the GDPR "OK" button</li>
<li>Open the chat</li>
<li>Post a test message in the chat with the text "This is a test message + [current date and time]"</li>
<ul>
  <li>Message will not be posted to not disturb sales/support team</li>
</ul>
</ul>

<h3>Create stream:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Check for existing videos "sample_video.MOV"</li>
<li>If the video does not exist, upload it</li>
<li>Go to the Live Streams page</li>
<li>Click on the "Create Stream" button</li>
<li>Select Standard Passthrough Channel</li>
<li>Open advanced options</li>
<li>Validate that Adaptive bitrate 1080p Akamai Delivery is present</li>
<li>Select Standard Passthrough Akamai Delivery</li>
<li>Enable DVR and later validate that it's enabled</li>
<li>Validate that Back button is present</li>
<li>Complete the stream creation process</li>
<li>Validate that Stream Online toggle is enabled</li>
<li>Copy the share link to clipboard and validate that copied link match the template</li>
<li>Navigate to the Live Streams page</li>
<li>Verify that the stream appears in the Live Streams page</li>
<li>Delete the stream</li>
<li>Validate that the stream is deleted</li>
</ul>

<h3>Create VOD2Live stream:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Check for existing videos "sample_video.MOV"</li>
<li>If the video does not exist, upload it</li>
<li>Go to the Live Streams page</li>
<li>Start the process of creating a new VOD to LIVE stream</li>
<li>Select different timezone</li>
<li>Select the video file for the stream</li>
<li>Complete the stream creation process</li>
<li>Copy the iFrame Embed Code to clipboard</li>
<li>Validate that the copied content is an Embed code with the expected structure</li>
<li>Navigate to the Live Streams page</li>
<li>Verify that the stream appears in the Live Streams page and is in the "Scheduled" status</li>
</ul>

<h3>Upload video:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Click on the "Upload Video" button</li>
<li>Select a video file to upload</li>
<li>Wait for the video to upload</li>
<li>Verify that the video is uploaded by checking the video list</li>
<li>Ensure the video appears in the list with the correct title "sample_video.MOV"</li>
<li>Click on the uploaded video to open its details page (side bar with quick settings)</li>
<li>Edit the video description to "This is a test video"</li>
<li>Save the changes and verify the success message "Changes have been saved"</li>
<li>Try to download the video and verify that the download starts (if download is enabled for the account)</li>
<li>If download doesn't start, log a message and mark the step as failed, but continue the test</li>
<li>Check the share link functionality:
  <ul>
    <li>Copy the share link</li>
    <li>Verify the link format</li>
    <li>Open the share link</li>
    <li>Attempt to play the video</li>
    <li>Verify that the video starts playing (note, video contains some audio)</li>
  </ul>
</li>
<li>Navigate back to the Videos page</li>
</ul>

<h3>Create folder:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Check for existing videos "sample_video.MOV" and "sample_video2.MOV"</li>
<li>If the videos do not exist, upload them</li>
<li>Go to the Folders page</li>
<li>Switch to Media Library view</li>
<li>Ensure the videos are visible in the media library</li>
<li>Create a new folder with name "This is a test folder + [current date and time]"</li>
<li>Move the videos to the new folder by two different ways:</li>
<ul>
  <li>Drag and drop</li>
  <li>Using the "Move to" context menu</li>
</ul>
<li>Verify that the videos are moved to the new folder</li>
<li>Navigate back to the Videos page</li>
<li>Verify that the videos are no longer visible in the media library when the "Unsorted" toggle is on</li>
</ul>

<h3>Create playlist:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Check for existing videos "sample_video.MOV" and "sample_video2.MOV"</li>
<li>If the videos do not exist, upload them</li>
<li>Create a new playlist with name "This is a test playlist + [current date and time]"</li>
<li>Add the videos to the playlist</li>
<li>Save the playlist</li>
<li>Verify that the changes have been saved</li>
<li>Navigate to the playlist preview</li>
<li>Play the video to ensure it is working correctly (note, video contains some audio)</li>
</ul>

<h3>Create Expo:</h3>
<ul>
<li>Go to the Videos page</li>
<li>Check for existing videos "sample_video.MOV" and "sample_video2.MOV"</li>
<li>If the videos do not exist, upload them</li>
<li>Validate that the video status is "Online" before proceeding</li>
<li>Navigate to the Expos page</li>
<li>Create a new Expo with name "This is a test expo + [current date and time]"</li>
<li>Add two videos to the Expo using drag and drop:
  <ul>
    <li>Add visual indicators for source and target elements to aid in visual verification</li>
    <li>Perform drag and drop operation</li>
    <li>Verify that the drag and drop operation was successful</li>
  </ul>
</li>
<li>Create a new section within the Expo</li>
<li>Move a video from the main Expo to the newly created section:
  <ul>
    <li>Add visual indicators for source (video) and target (section) elements</li>
    <li>Perform drag and drop operation</li>
    <li>Verify that the video was successfully moved to the section</li>
  </ul>
</li>
<li>Verify that the videos are correctly placed in the Expo and its section</li>
<li>Configure SEO settings for the Expo:
  <ul>
    <li>Set a custom SEO title</li>
    <li>Set a custom SEO description</li>
  </ul>
</li>
<li>Save the Expo and get the sharing URL</li>
<li>Navigate to the sharing Expo URL and verify:
  <ul>
    <li>The page loads successfully</li>
    <li>The Expo title is displayed correctly</li>
  </ul>
</li>
</ul>

<h3>Validate Free Trial:</h3>
<ul>
<li>Navigate to the Dacast homepage</li>
<li>Enter email and click on the "Start Free Trial" button</li>
<li>Fill out the free trial registration form with test data:
  <ul>
    <li>First Name</li>
    <li>Last Name</li>
    <li>Work Email</li>
    <li>Phone Number</li>
    <li>Password</li>
    <li>Company URL</li>
  </ul>
</li>
<li>Click the "Sign up free" button</li>
<li>[Pending] Bypass reCAPTCHA verification (to be implemented)</li>
<li>[Pending] Confirm successful free trial registration (to be implemented once reCAPTCHA bypass is available)</li>
</ul>

**How to run:**<br>

Update host and credentials in the env file. Then do following:<br>

Entire suite in parallel: _npm test_<br>

Chat and GDPR banner test: _npm run test:chat_<br>
Create stream: _npm run test:stream_<br>
Create VOD2Live stream: _npm run test:vod2live_<br>
Upload video: _npm run test:upload_<br>
Create playlist: _npm run test:playlist_<br>
Create folder: _npm run test:folder_<br>
Create Expo: _npm run test:expo_<br>
Validate Free Trial: _npm run test:trial_<br>


To run all tests one by one: _npm run test:all_<br>

**How to see the report:**<br>
_npx playwright show-report_
