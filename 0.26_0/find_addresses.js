

var str = document.documentElement.innerHTML;



var addresses = str.match(/[\s>&"\:][13][1-9A-HJ-NP-Za-km-z]{26,33}[\s<&"\?\.]/g);

var uris = str.match(/bitcoin:[13][1-9A-HJ-NP-Za-km-z]{26,33}\?&?amount=[0-9\.]+/g);

uriArr = [];

for ( i in uris )
{

	uriAddress = uris[i].match(/[13][1-9A-HJ-NP-Za-km-z]{26,33}/g);
	uriAmount = uris[i].match(/=[0-9\.]+/g);

	uriAmount = uriAmount[0].replace("=", "");
	uriArr.push( {address: uriAddress[0], amount: uriAmount } );
}

var object = { "addresses": addresses, "uris": uriArr, "type": "addressResults" };

chrome.extension.sendRequest(object);
