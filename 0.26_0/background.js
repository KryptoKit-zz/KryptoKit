
bg = {

	"msgCount": 0
}


var audio = new Audio("message.ogg");

checkMessages();
getFiatValue();


setInterval( function() {
	checkMessages();
	getFiatValue();

}, 60000 );	



function getFiatValue ()
{

	chrome.storage.local.get(["currency"], function (data) {
		
		var currency ="USD";


		if ( data.currency )
		{

			currency = data.currency;
		}

		$.ajax({
		    type: "GET",
		    url: "https://api.bitcoinaverage.com/ticker/" + currency,
		    async: true,
		    data: {}

		}).done(function (msg) {
		    price = msg.last;

		    

		    chrome.storage.local.set( {"price": price} , function (data) {

		    });

		    

		});

	});

	
}


function checkMessages( )
{

	chrome.storage.local.get(["gpgPublic", "prevSecret"], function (data) {

		if ( data.gpgPublic )
		{
			openpgp.init();

			var publicKey = openpgp.read_publicKey( data.gpgPublic );

			var keyid = s2hex( publicKey[0].publicKeyPacket.getKeyId() );
		}
		else
		{
			
			
			return;	
		}
	   

		$.ajax({
		    url: "http://rush.rubixapps.com/gpg.php",
		    data: { "function": "countMessages", "keyid": keyid, "prevSecret": data.prevSecret },
		    type: "POST",
		    dataType: "json",
		    success: function (res) {
		    	
		    	if ( res.count != "0" )
		    	{
		    		chrome.browserAction.setBadgeText({text: "" + res.count });
		    		
		    		if ( bg.count != res.count )
		    		{
		    			audio.play();
		    		}

		    		bg.count = res.count;

		    		chrome.extension.sendRequest({"msgCount":res.count, "type": "messageCount"});


		    	}

		    	chrome.storage.local.set( {"msgCount": res.count} , function (data) {

		    	});

		    	
		    },
		    error: function (xhr, opt, err) {
		        
		    }
		});

	});


	

}

function saveMsg( msg )
{
	if ( !msg )
	{
		msg = "";
	}

	chrome.storage.local.set( {"msgBuffer": msg} , function (data) {
	});
	
}

function s2hex(s)
{
  var result = '';
  for(var i=0; i<s.length; i++)
  {
    c = s.charCodeAt(i);
    result += ((c<16) ? "0" : "") + c.toString(16);
  }
  return result;
}