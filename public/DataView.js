async function authoriseDataView() {
  const form = document.getElementById('authUsersForm');
  if (!form) return;

  if (form) {
    try {
      const getIp = await fetch('https://api.ipify.org?format=json');
      const { ip } = await getIp.json();

      
    } catch (error) {
      console.error('Error fetching IP:', error);
    }
  }
}
