async function authoriseDataView() {
  const form = document.getElementById('authoriseDataViewButton');
  if (!form) return;

  if (form) {
    try {
      const serverResponse = await fetch('/auth/user/user'); //poamaga uzyskać dostęp do endpointu
      const authData = await serverResponse.json();

      console.log(authData);
      console.log(authData.authData.lastLoginIp);
      console.log(authData.authData.lastLoginDate);
      console.log(authData.authData.knownIpHashes);

      if (
        authData.authData.knownIpHashes &&
        authData.authData.knownIpHashes.length > 0
      ) {
        const getIpIdentifier =
          authData.authData.knownIpHashes[
            authData.authData.knownIpHashes.length - 1
          ];
        const [ipHash, ipDate] = getIpIdentifier.split('|');

        console.log('Last known IP hash:', ipHash);
        console.log('Last known IP date:', ipDate);
      }
    } catch (error) {
      typeof error === 'string' || error instanceof Error;
      if (typeof error === 'string') {
        console.error('Error fetching IP:', error);
        document.getElementById('authUsersForm').style.filter = 'blur(10px)';
        document.getElementById('authUsersForm').style.display = 'block';
      } else {
        return false;
      }
    }
  }
  document.getElementById('authUsersForm').style.filter = 'none';
  document.getElementById('authUsersForm').style.display = 'none';
}
