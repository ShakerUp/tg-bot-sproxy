import proxyCheck from 'proxy-check';

async function testProxy(proxy) {
  const formattedProxy = {
    host: proxy.hostIp,
    port: proxy.httpPort,
    proxyAuth: `${proxy.login}:${proxy.password}`,
  };

  return new Promise((resolve, reject) => {
    proxyCheck(formattedProxy)
      .then((result) => {
        resolve(result);
      })
      .catch((error) => {
        // В случае ошибки при проверке прокси, считаем, что прокси не работает
        console.error('Ошибка при проверке прокси:', error.message);
        resolve(false); // Прокси не работает
      });
  });
}

export default testProxy;
