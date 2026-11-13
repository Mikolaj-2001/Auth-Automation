async function fetchLastPersonalID() {
  const button = document.getElementById('verifyButton');
  if (!button) {
    return;
  }

  if (button) {
    try {
      const response = await fetch('/user/last-personal-id');
      const idData = await response.json();

      if (
        idData &&
        idData.lastPersonalID &&
        typeof idData.lastPersonalID === 'number'
      ) {
        console.log('Last personal ID:', idData.lastPersonalID);
      }
    } catch (error) {
      typeof error === 'string' || error instanceof Error;
      if (typeof error === 'string') {
        console.error('Failed to fetch last personal ID:', error);
        document.getElementById('registerButton').style.filter = 'blur(10px)';
        document.getElementById('registerButton').style.display =
          'inline-block';
      }
      return;
    }
  }
  document.getElementById('registerButton').style.display = 'none';
}
