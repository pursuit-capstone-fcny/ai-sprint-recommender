// Compatibility entry point for projects that already use this editor helper.
// Replace this file and deploy the updated collector before running it.
function useLibraryRequestsTab() {
  console.log(JSON.stringify(migrateRequestsToLibrary()));
}
