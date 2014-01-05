var entroMouse = window.entroMouse = {

    "generating": false,
    "chars": "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ",
    "max": 50,
    "string": "",

    "start": function ()
    {
        setMsg("<b>To generate a new Bitcoin wallet address please move your mouse around randomly in this window.</b>")

        this.max = 50;

        var ua = navigator.userAgent.toLowerCase();


        this.generating = true;
        document.onmousemove = this.mmove;

    },

    "mmove": function (ns)
    {
        if (entroMouse.generating)
        {

            X = ns.pageX;
            Y = ns.pageY;

            time = new Date().getTime();

            var num = (Math.pow(X,3)
                          + Math.pow(Y,3) 
                          + Math.floor(time*1000) 
                          + Math.floor(Math.random() * 1000)) % 62;

            if (time % 4 == 1)
            {
                if (entroMouse.max--)
                {
                    entroMouse.string += entroMouse.chars.charAt(num % entroMouse.chars.length);

                    $("#address").html(entroMouse.string);

                }
                else
                {


                    entroMouse.generating = false;


                    var bytes = Bitcoin.Crypto.SHA256(entroMouse.string,
                    {
                        asBytes: true
                    });

                    var btcKey = new Bitcoin.Key(bytes);
                    var address = btcKey.getBitcoinAddress().toString();

                    rush.passcode = entroMouse.string;

                    rush.address = address;

                    $("#errorBox").hide();

                    chrome.storage.local.set(
                    {
                        'code': entroMouse.string,
                        'address': address,
                        "encrypted": false
                    }, function ()
                    {

                        rush.open();

                        //rush.preparePassword(); //force password set

                    });


                }
            }

        }
    }
}

// -- transactions --

var txType = 'txBCI';

function txGetUnspent()
{
    var addr = rush.address;

    var url = (txType == 'txBCI') ? 'http://blockchain.info/unspent?address=' + addr :
        'http://blockexplorer.com/q/mytransactions/' + addr;

    //url = prompt('Press OK to download transaction history:', url);
    if (url != null && url != "")
    {
        rush.txUnspent = '';
        ajax(url, txParseUnspent);
    }
    else
    {
        txSetUnspent(rush.txUnspent);
    }
}


function txSetUnspent(text)
{
    var r = JSON.parse(text);
    txUnspent = JSON.stringify(r, null, 4);
    rush.txUnspent = txUnspent;
    var address = rush.address;
    TX.parseInputs(txUnspent, address);
    var value = TX.getBalance();
    var fval = value / 100000000;
    var fee = parseFloat(rush.txFee);
    rush.balance = fval;
    rush.txValue = fval - fee;
    txRebuild();
}

function txParseUnspent(text)
{
    if (text == '')
        setMsg('No data');
    else
        txSetUnspent(text);
}

function txOnAddDest()
{
    var list = $(document).find('.txCC');
    var clone = list.last().clone();
    clone.find('.help-inline').empty();
    clone.find('.control-label').text('Cc');
    var dest = clone.find('#txDest');
    var value = clone.find('#txValue');
    clone.insertAfter(list.last());
    onInput(dest, txOnChangeDest);
    onInput(value, txOnChangeDest);
    dest.val('');
    value.val('');
    $('#txRemoveDest').attr('disabled', false);
    return false;
}

function txOnRemoveDest()
{
    var list = $(document).find('.txCC');
    if (list.size() == 2)
        $('#txRemoveDest').attr('disabled', true);
    list.last().remove();
    return false;
}

function txSent(text)
{
    //setMsg(text ? text : 'No response!');
    if (!/Transaction Submitted/.test(text))
    {
        if (rush.counter < 3)
        {
            //     setTimeout(function () {
            //         txSend()
            //     }, 200);

            //     rush.counter++;
        }
        else
        {
            rush.counter = 0;
            setMsg("There seems to be a problem with building the transaction. This in no way affects the safety of your Bitcoins.")

            rush.txSec = "";
        }
    }
    else
    {
        rush.txComplete();
    }
}

function txSend()
{
    var txAddr = rush.address;
    var address = TX.getAddress();

    var r = '';
    if (txAddr != address)
        r += 'Warning! Source address does not match private key.\n\n';

    var tx = rush.txHex;

    url = 'http://blockchain.info/pushtx';
    postdata = 'tx=' + tx;
    //url = prompt(r + 'Send transaction:', url);
    if (url != null && url != "")
    {
        ajax(url, txSent, postdata);
    }
    return false;
}

function txRebuild()
{
    var sec = rush.txSec;
    var addr = rush.address;
    var unspent = rush.txUnspent;
    var balance = parseFloat(rush.balance);
    var fee = parseFloat('0' + rush.txFee);

    try
    {
        var res = Bitcoin.base58.checkDecode(sec);
        var version = res.version;
        var payload = res.slice(0);
    }
    catch (err)
    {
        rush.txJSON = "";
        rush.txHex = "";

        return;
    }

    var compressed = false;
    if (payload.length > 32)
    {
        payload.pop();
        compressed = true;
    }

    var eckey = new Bitcoin.Key(payload);

    eckey.setCompressed(compressed);

    TX.init(eckey);

    var fval = 0;
    var o = txGetOutputs();
    for (i in o)
    {
        TX.addOutput(o[i].dest, o[i].fval);
        fval += o[i].fval;
    }

    // send change back or it will be sent as fee
    if (balance > fval + fee)
    {
        var change = balance - fval - fee;
        TX.addOutput(addr, change);
    }
    try
    {
        var sendTx = TX.construct();
        var txJSON = TX.toBBE(sendTx);
        var buf = sendTx.serialize();
        var txHex = Bitcoin.convert.bytesToHex(buf);
        rush.txJSON = txJSON;
        rush.txHex = txHex;
    }
    catch (err)
    {
        rush.txJSON = "";
        rush.txHex = "";
    }
    txSend();
}

function txOnChangeDest()
{
    var balance = parseFloat(rush.balance);
    var fval = parseFloat('0' + rush.txValue);
    var fee = parseFloat('0' + rush.txFee);

    if (fval + fee > balance)
    {
        fee = balance - fval;
        rush.txFee = fee > 0 ? fee : '0.00';
    }

    clearTimeout(timeout);
    //timeout = setTimeout(txRebuild, TIMEOUT);
}


// function txOnChangeFee() {

//     var balance = parseFloat($('#txBalance').val());
//     var fee = parseFloat('0'+$('#txFee').val());

//     var fval = 0;
//     var o = txGetOutputs();
//     for (i in o) {
//         TX.addOutput(o[i].dest, o[i].fval);
//         fval += o[i].fval;
//     }

//     if (fval + fee > balance) {
//         fval = balance - fee;
//         $('#txValue').val(fval < 0 ? 0 : fval);
//     }

//     if (fee == 0 && fval == balance - 0.0005) {
//         $('#txValue').val(balance);
//     }

//     clearTimeout(timeout);
//     timeout = setTimeout(txRebuild, TIMEOUT);
// }

function txGetOutputs()
{
    var res = [];
    // $.each($(document).find('.txCC'), function() {
    //     var dest = rush.txDest;
    //     var fval = parseFloat('0' + $(this).find('#txValue').val());
    //     res.push( {"dest":dest, "fval":fval } );
    // });

    var dest = rush.txDest;
    var fval = parseFloat('0' + rush.txAmount);
    res.push(
    {
        "dest": dest,
        "fval": fval
    });


    return res;
}

rush = window.rush = {

    "passcode": "",
    "address": "",
    "txSec": "",
    "balance": 0,
    "txUnspent": "",
    "txValue": 0,
    "txFee": 0.0001,
    "txAmount": .001,
    "txDest": "",
    "counter": 0,
    "encrypted": false,
    "gpgPrivate": "",
    "gpgPublic": "",
    "gpgKeys": Array(),
    "gpgPage": Array(),
    "price": 0,
    "gpgMessages": Array(),
    "gpgPassword": "",
    "msgBuffer": "",
    "prevSecret": "",
    "lastTab": "",
    "currency": "USD",
    "currencyOptions": ["AUD","BRL","CAD","CHF","CNY","CZK","EUR","GBP","ILS","JPY","NOK","NZD","PLN","RUB","SEK","SGD","USD","ZAR"],
    "pageArray": ['wallet', 'gpg', 'news', 'chart', 'settings', 'help', 'donate'],
    "newsType": 1,
    "newsOptions": ['Google News','Reddit','Google News/Reddit','Reddit/Google News'],
    "donateOptions": [ ["Sean's Outpost", "1M72Sfpbz1BPpXFHz9m3CdqATR44Jvaydd", "http://seansoutpost.com/"] ],

    "open": function ()
    {

        var manifest = chrome.runtime.getManifest();

        $(".logo").html("KryptoKit v" + manifest.version);

        $("#addressTitle").show();
        $("#balanceBox").show();

        if (this.encrypted)
        {
            $("#preparePassword").hide();
            $("#password").show();
            // setTimeout(function ()
            // {
            //     // $("body").css("height", "357px");
            // }, 200);

        }
        else
        {
            $("#removePassword").hide();
        }

        if (this.gpgPrivate)
        {
            $("#gpgCreate2").hide();
        }



        $("#address").html(this.address);

        this.getBalance();

        var socket = new WebSocket("ws://ws.blockchain.info:8335/inv");

        socket.onopen = function (msg)
        {
            var message = {
                "op": 'addr_sub',
                "addr": rush.address
            };

            socket.send(JSON.stringify(message));
        }

        socket.onmessage = function (msg)
        {
            setTimeout(function ()
            {
                rush.getBalance();
                playBeep();
            }, 500);
        }

        // if ( rush.lastTab == "gpg" )
        // {
        //     setTimeout(function ()
        //     {
        //         rush.openGpgTab();
        //     }, 200);
        // }


    },

    "backup": function ()
    {
        backup = {
            "passcode": this.passcode,
            "address": this.address,
            "txFee": this.txFee,
            "encrypted": this.encrypted,
            "gpgPrivate": this.gpgPrivate,
            "gpgPublic": this.gpgPublic,
            "gpgKeys": this.gpgKeys,
            "gpgMessages": this.gpgMessages,
            "newsType": this.newsType,
            "currency": this.currency

        };

        var json = JSON.stringify(backup);

        var blob = new Blob([json],
        {
            type: "application/json"
        });
        var url = URL.createObjectURL(blob);

        var a = document.createElement('a');
        a.download = "backup.json";
        a.href = url;
        a.textContent = "Download KryptoKit backup file";

        setSettingsMsg("");

        document.getElementById('settingsErrorBox').appendChild(a);

    },
    "help": function ()
    {
        this.openTab("help");

        // chrome.tabs.create({url: chrome.extension.getURL('help.html')});
    },
    "userManual": function ()
    {
        chrome.tabs.create({
          'url':'http://kryptokit.com/getting-started.html' }, function(tab) {
          });
    },
    "prepareRestore": function ()
    {
        chrome.tabs.create({url: chrome.extension.getURL('restore.html')});
    },
    "restore": function (evt)
    {
        var files = evt.target.files;
        f = files[0];
        var reader = new FileReader();

        reader.onload = (function (theFile)
        {
            return function (e)
            {
                JsonObj = e.target.result

                try
                {
                    var restore = JSON.parse(JsonObj);
                }
                catch (e)
                {
                    setMsg("Restore file looks malformed");
                    return;
                }


                rush.passcode = restore.passcode;
                rush.address = restore.address;
                rush.txFee = restore.txFee;
                rush.encrypted = restore.encrypted;
                rush.gpgPrivate = restore.gpgPrivate;
                rush.gpgPublic = restore.gpgPublic;
                rush.gpgKeys = restore.gpgKeys;
                rush.gpgMessages = restore.gpgMessages;
                rush.newsType = restore.newsType;
                rush.currency = restore.currency;

                chrome.storage.local.set(
                {
                    'code': rush.passcode,
                    'encrypted': rush.encrypted,
                    'txFee': rush.txFee,
                    "address": rush.address,
                    "gpgPrivate": rush.gpgPrivate,
                    "gpgPublic": rush.gpgPublic,
                    "gpgKeys": rush.gpgKeys,
                    "gpgMessages": rush.gpgMessages,
                    "newsType": rush.newsType,
                    "currency": rush.currency
                }, function ()
                {
                    setMsg("Backup restored succesfully!");

                });

            };
        })(f);

        reader.readAsText(f, 'UTF-8');




    },

    "check": function ()
    {


        if (parseFloat($("#txtAmount").val()) > this.balance)
        {
            setMsg("You are trying to send more BTC than you have in your balance!");
            return false;
        }
        
        if (parseFloat($("#txtAmount").val()) + this.txFee > this.balance)
        {
            setMsg("You need to leave enough room for the " + this.txFee + " btc miner fee");
            return false;
        }

        if (parseFloat($("#txtAmount").val()) == 0)
        {
            setMsg("Please enter an amount!");

            return false;
        }

        if ( !this.checkAddress( $('#txtAddress').val() ) )
        {
            setMsg("Malformed address!");

            return false;
        }

       return true;
    },
    "checkAddress": function ( address )
    {
        try
        {
            var res = Bitcoin.base58.checkDecode(address);
            var version = res.version
            var payload = res.slice(0);
            if (version == 0)
                return true;
        }
        catch (err)
        {
            return false;
        }
    },
    "send": function ()
    {
        if (!this.check())
        {
            return;
        }

        if (this.encrypted)
        {

            if ($("#password").val() == "")
            {
                setMsg("Your wallet is encrypted. Please enter a password.");
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());

            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode)
            {
                setMsg("Wrong Password!");
                return;
            }

        }
        else
        {
            var passcode = this.passcode;
        }

        var bytes = Bitcoin.Crypto.SHA256(passcode,
        {
            asBytes: true
        });

        var btcKey = new Bitcoin.Key(bytes);

        this.txSec = btcKey.export("base58");
        this.txAmount = parseFloat($("#txtAmount").val());
        this.txAmount = this.txAmount.toFixed(8);
        this.txDest = $('#txtAddress').val();
        txGetUnspent();

        $("#send").attr("disabled", "disabled");
        $("#send").html("Sending...");

    },


    "getBalance": function ()
    {
        var url = "https://blockchain.info/q/addressbalance/" + this.address;

        $.ajax(
        {
            type: "GET",
            url: url,
            async: true,
            data:
            {}

        }).done(function (msg)
        {
            rush.balance = msg / 100000000;
            var spendable = rush.balance - rush.txFee;

            if (spendable < 0)
                spendable = 0;

            $("#balance").html("฿" + rush.balance.toFixed(8));
            $("#spendable").html("฿" + spendable.toFixed(8));

            rush.getFiatValue();

        });



    },
    "getFiatValue": function ()
    {

        this.fiatValue = this.price * rush.balance;

        $("#fiatValue").html("(" + this.getFiatPrefix() + formatMoney(this.fiatValue.toFixed(2)) + ")");

        $("#currentPrice").html( this.getFiatPrefix() + formatMoney(rush.price.toFixed(2)));
    },
    "getFiatPrice": function ()
    {
        currency = this.currency;

        $.ajax({
            type: "GET",
            url: "https://api.bitcoinaverage.com/ticker/" + currency,
            async: true,
            data: {}

        }).done(function (msg) {
            price = msg.last;

            rush.price = price;
            chrome.storage.local.set( {"price": price} , function (data) {

            });

            rush.getFiatValue();


        });

    },
    "amountFiatValue": function ()
    {

        var amount = $("#txtAmount").val();

        amount = parseFloat(amount);

        if (!amount)
        {
            amount = 0;
        }

        var fiatValue = this.price * amount;

        fiatValue = fiatValue.toFixed(2);

        $("#send").html("Send (" + this.getFiatPrefix() + formatMoney(fiatValue) + ")");
    },
    "prepareReset": function ()
    {
        setMsg("Are you sure you want to generate a new address? <strong>This will delete your current one and all funds associated with it.</strong> <br/><button id='confirmReset'>Yes</button> <button id='noReset'>No</button>");
    },
    "reset": function ()
    {


        $("#errorBox").hide();

        // chrome.storage.local.set(
        // {
        //     'encrypted': false
        // }, function () {});

        $("#balanceBox").hide();
        $("#password").hide();
        $("#preparePassword").show();
        this.encrypted = false;
        this.passcode = "";
        this.address = "";
        this.txSec = "";
        entroMouse.string = "";
        entroMouse.start();

    },
    "removePassword": function ()
    {
        setMsg("Enter your password to disable it. <input type='password' id='passwordTxt' placeholder='password'> <button id='confirmRemovePassword'>Remove Password</button>");
    },
    "confirmRemovePassword": function ()
    {
        var decrypted = CryptoJS.AES.decrypt(this.passcode, "" + $("#passwordTxt").val() );

        var passcode = decrypted.toString(CryptoJS.enc.Utf8);

        if (!passcode)
        {
            setMsg("Incorrect Password!");
            return;
        }

        this.password = passcode;

        this.encrypted = false;

        chrome.storage.local.set(
        {
            'code': passcode,
            'encrypted': false
        }, function ()
        {
            setMsg("Password has been removed succesfully!");

            $("#password").hide();
            $("#removePassword").hide();
            $("#preparePassword").show();
        });


    },
    "preparePassword": function ()
    {
        setMsg("Please set a password below: <br/><input type='password' id='setPassword' placeholder='password'> <input type='password' id='setPassword2' placeholder='repeat password'> <button id='setPasswordBtn'>Set Password</button>");
        $("#setPassword").focus();
    },
    "setPassword": function ()
    {
        if ($("#setPassword").val() != $("#setPassword2").val())
        {
            setMsg("Passwords did not match! Please try again.");

            return;
        }


        var encrypted = CryptoJS.AES.encrypt(this.passcode, $("#setPassword").val());

        this.passcode = encrypted;
        this.encrypted = true;

        chrome.storage.local.set(
        {
            'code': encrypted,
            'encrypted': true
        }, function ()
        {
            setMsg("Password has been set succesfully!");

            $("#password").show();
            $("#preparePassword").hide();
        });

    },
    "openTab": function ( tab )
    {
        for ( i in this.pageArray )
        {
            if ( this.pageArray[i] != tab )
            {
                $( "#" + this.pageArray[i] + "Tab" ).removeClass("selected");
                $( "#" + this.pageArray[i] + "Page" ).hide();
            }
        }

        $( "#" + tab + "Tab" ).addClass("selected");
        $( "#" + tab + "Page" ).show();

        chrome.storage.local.set(
        {
            'lastTab': tab,
        }, function (){});

        $("#settingsErrorBox").hide();
        $("body").css("height", "");
        $("body").css("min-height", "0px");

    },
    "openGpgTab": function ()
    {
        this.openTab("gpg");

        $("#gpgErrorBox").hide();
        $("body").css("min-height", "204px");
        $("body").css("height", "");

        setTimeout( function () {rush.gpgListMessages();}, 300 )
    },
    "openWalletTab": function ()
    {
        this.openTab("wallet");
    },
    "openNewsTab": function ()
    {
        this.openTab("news");
        $("#news").html("<span id='loading'>Loading...</span>");

        switch ( parseInt(this.newsType) )
        {
            case 1:
                rush.loadNews();
                break;
            case 2:
                rush.loadRedditNews();
                break;
            case 3:
                rush.loadNews( function () { rush.loadRedditNews();} );
                break;
            case 4:
                rush.loadRedditNews( function () {rush.loadNews();} );
                break;
        }        

        $("#newsTitle").html( this.newsOptions[this.newsType - 1] );

    },
    "openChartTab": function ()
    {
        this.openTab("chart");

        this.getCharts();
    },
    "loadNews": function ( callbk )
    {

        $.ajax(
        {
            url: "https://news.google.com/news/feeds?q=bitcoin&output=rss&num=25",
            dataType: "xml",
            data:
            {
                
            },

            type: "GET",
            success: function (res)
            {

                if ( $(res).find('item').size() )
                {

                    $(res).find('item').each(function(){
                        var title = $(this).find("title").text();
                        var link = $(this).find("link").text();
                        regex = /url\=+(http\:\/\/.*)/g;
                        var cleanLink = regex.exec(link);
                        cleanLink = cleanLink[1];
                        var pubDate = new Date ( $(this).find("pubDate").text() );
                        date = pubDate.format("MM/dd h:mmz");
                        $("#news").append( "<div class='newsItem' link='" + cleanLink + "'> <div class='newsDate'>" + date + "</div><div class='newsTitle'>" + htmlEncode( title ) + " </div></div>" );
                    });
                }

                $("#loading").hide();

                if ( callbk )
                {
                    callbk();
                }
                

            },
            error: function (xhr, opt, err)
            {
                $("#news").html("Error loading news!");
            }
        });
    },
    "loadRedditNews": function ( callbk )
    {
        //$("#news").html("Loading...");

        $.ajax(
        {
            url: "http://www.reddit.com/r/Bitcoin/hot.json?limit=25",
            dataType: "json",
            data:
            {
                
            },

            type: "GET",
            success: function (res)
            {
                //$("#news").html("");

                for ( i in res.data.children )
                {
                    if ( !res.data.children[i].data.stickied )
                    {
                        if ( res.data.children[i].data.thumbnail != "self" && res.data.children[i].data.thumbnail != "default" )
                        {
                            var img = "<img src='" + res.data.children[i].data.thumbnail + "'>";
                        }
                        else
                        {
                            var img = "";
                            var img = "<img src='reddit-logo.png' class='newsBlank'>";

                        }


                        $("#news").append( "<div class='newsItemReddit' link='" + res.data.children[i].data.permalink + "'><div class='newsThumb'>" + img + " <div class='newsPoints'>" + res.data.children[i].data.score + "</div></div> <div class='newsTitleReddit'>" + htmlEncode(res.data.children[i].data.title) + "</div></div>" );
                    }

                    $("#loading").hide();

                }

                if ( callbk )
                {
                    callbk();
                }

            },
            error: function (xhr, opt, err)
            {
                $("#news").html("Error loading news!");
            }
        });
    },
    "txComplete": function ()
    {
        setMsg("Payment sent!");

        $("#send").removeAttr("disabled");
        $("#send").html("Send");

        this.txSec = "";

        $("#password").val("");

        $("#txtAmount").val("");
        $("#txtAddress").val("");

        this.getBalance();

    },
    "exportWallet": function ()
    {

        if (!this.encrypted)
        {
            setMsg("" + rush.passcode);
        }
        else
        {
            if ($("#password").val() == "")
            {
                setMsg("Please enter password to decrypt wallet.");
                return;
            }

            var passcode = CryptoJS.AES.decrypt(this.passcode, $("#password").val());

            var passcode = passcode.toString(CryptoJS.enc.Utf8);

            if (!passcode)
            {
                setMsg("Incorrenct Password!");
                return;
            }

            setMsg("Brainwallet: " + passcode);

            $("#password").val("");

        }

    },
    "importWallet": function ()
    {
        setMsg("Importing a brain wallet will replace your current wallet. You will lose your balance if you haven't backed it up!<br/><input type='text' id='importBrainTxt' placeholder='Brainwallet'> <button id='confirmImport'>Import</button>");
    },
    "confirmImport": function ()
    {

        if (!$("#confirmImport").attr("confirmed"))
        {
            $("#confirmImport").html("Are you sure? Click to confirm!").attr("confirmed", "true");
            $("<button id='clearBox'>No</button>").insertAfter("#confirmImport");
            return;
        }

        rush.passcode = $("#importBrainTxt").val();

        var bytes = Bitcoin.Crypto.SHA256(rush.passcode,
        {
            asBytes: true
        });

        var btcKey = new Bitcoin.Key(bytes);
        var address = btcKey.getBitcoinAddress().toString();

        rush.address = address;

        $("#password").hide();
        $("#preparePassword").show();
        this.encrypted = false;
        this.txSec = "";

        chrome.storage.local.set(
        {
            'code': rush.passcode,
            'encrypted': false,
            'address': address
        }, function ()
        {
            rush.open();

        });

        setMsg("Brainwallet imported succesfully!");



    },
    "gpgCreate": function ()
    {
        setGPGMsg("Please enter a password to create your GPG keypair.<br/><input type='text' id='gpgName' placeholder='Name'><br/><input type='text' id='gpgEmail' placeholder='E-mail Address'> <br/><input type='password' id='gpgPassword' placeholder='Password'> <br/><input type='password' id='gpgPassword2' placeholder='Repeat Password'> <button id='confirmGPGCreate'>Create GPG Keypair</button>");
    },
    "confirmGPGCreate": function ()
    {

        if (!$("#confirmGPGCreate").attr("confirmed"))
        {
            $("#confirmGPGCreate").html("Are you sure? Click to confirm!").attr("confirmed", "true");
            $("<button id='clearBox'>No</button>").insertAfter("#confirmGPGCreate");
            return;
        }

        // $("#confirmGPGCreate").html("Generating...").attr("disabled", "disabled");

        if ($("#gpgPassword").val() != $("#gpgPassword2").val())
        {
            setGPGMsg("Passwords did not match! Please try again.");

            return;
        }

        if ($("#gpgName").val() == "")
        {
            setGPGMsg("Please enter a name for the GPG key");

            return;
        }

        openpgp.init();

        keypair = openpgp.generate_key_pair(1, 2048, $("#gpgName").val() + " <" + $("#gpgEmail").val() + ">", $("#gpgPassword").val());

        this.gpgPublic = keypair.publicKeyArmored;

        this.gpgPrivate = keypair.privateKeyArmored;

        chrome.storage.local.set(
        {
            'gpgPrivate': rush.gpgPrivate,
            'gpgPublic': rush.gpgPublic
        }, function ()
        {

            setGPGMsg('Keypair generated Succesfully! Share the public key below with others you wish to receive encrypted messages from: <br/><br/><textarea id="gpgBox" readonly></textarea><br/><button id="shareKey" share="mailto:?subject=' + encodeURIComponent("Heres my public GPG key!") + '&body=' + encodeURIComponent( rush.gpgPublic ) + '">E-mail Key</button>');

            $("#gpgBox").val( rush.gpgPublic);

            $("#gpgCreate2").hide();

            chrome.storage.local.set(
            {
                'gpgPassword': ""
            }, function ()
            {
                rush.gpgPassword = "";
            });

        });


    },
    "gpgImport": function ()
    {

        setGPGMsg('Please enter a Public GPG key to import:<br/>    <textarea id="gpgPublicKey" placeholder="GPG Public Key..."></textarea> <button id="confirmGPGImport">Import Key</button>');
    },
    "confirmGPGImport": function ()
    {
        openpgp.init();

        var keyTxt = $("#gpgPublicKey").val();

        if (/PUBLIC KEY/.test(keyTxt))
        {
            var key = openpgp.read_publicKey(keyTxt);
            var user = key[0].userIds[0].text;

            if (!user)
            {
                setGPGMsg("Key not valid!");
                return;
            }

        }
        else
        {
            setGPGMsg("Key not valid!");
            return;
        }

        var keyId = s2hex(key[0].publicKeyPacket.getKeyId());

        user = user.replace("<>", "");

        this.gpgKeys.push(
        {
            "name": user,
            "key": keyTxt,
            "keyId": keyId
        });

        rush.gpgKeys.sort(function (a, b)
        {
            return (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : 1;
        });

        chrome.storage.local.set(
        {
            'gpgKeys': rush.gpgKeys
        }, function ()
        {

            setGPGMsg("Key for '" + user + "' added succesfully!");

        });

    },
    "gpgImportPrivate": function ()
    {

        setGPGMsg('Please enter a Private GPG key to import, this will replace any current private key that is stored:<br/> <textarea id="gpgPrivateKey" placeholder="GPG Private Key..."></textarea> <button id="gpgConfirmImportPrivate">Import Key</button>');

    },
    "gpgConfirmImportPrivate": function ()
    {


        if (!$("#gpgConfirmImportPrivate").attr("confirmed"))
        {
            $("#gpgConfirmImportPrivate").html("Are you sure? Click to confirm!").attr("confirmed", "true");
            $("<button id='clearBox'>No</button>").insertAfter("#gpgConfirmImportPrivate");
            return;
        }

        openpgp.init();

        var privateKeyTxt = $("#gpgPrivateKey").val();

        if (/PRIVATE KEY/.test(privateKeyTxt))
        {

            var privateKey = openpgp.read_privateKey(privateKeyTxt);

            var publicKeyTxt = privateKey[0].extractPublicKey();


        }
        else
        {
            setGPGMsg("Key not valid!");
            return;
        }

        rush.gpgPrivate = privateKeyTxt;

        rush.gpgPublic = publicKeyTxt;

        chrome.storage.local.set(
        {
            'gpgPublic': rush.gpgPublic,
            'gpgPrivate': rush.gpgPrivate
        }, function ()
        {

            setGPGMsg("Private key imported succesfully!");

        });

    },
    "gpgEncrypt": function ()
    {
        if (!rush.gpgKeys.length)
        {
            setGPGMsg("You do not have any public keys imported. You can import using the 'Manage Keys' button.")
            return;
        }

        setGPGMsg("Please select key to encrypt with: <br/> <select id='gpgs' size='8'></select> <div><textarea id='gpgEncryptTxt' placeholder='Enter Message...'></textarea></div> <button id='gpgConfirmEncrypt'>Encrypt</button>")

        for (var index in rush.gpgKeys)
        {

            $("#gpgs").append("<option value='" + index + "' user='" + htmlEncode(rush.gpgKeys[index].name) + "'>" + htmlEncode(rush.gpgKeys[index].name) + "</option>");

        }

        if (this.msgBuffer)
        {
            $("#gpgEncryptTxt").val(this.msgBuffer);
        }


    },
    "gpgConfirmEncrypt": function ()
    {
        var userID = $('#gpgs').val();

        if (userID == null)
        {
            return;
        }

        openpgp.init();

        var encrypted = openpgp.write_encrypted_message(openpgp.read_publicKey(this.gpgKeys[userID].key), $("#gpgEncryptTxt").val());

        popup(encrypted);



    },
    "getCheck": function ()
    {
        if (this.gpgPassword)
        {
            $("#gpgSavePassword").attr("checked", "checked");
            $("#gpgPassword").val(this.gpgPassword);
        }
    },
    "gpgSavePassword": function ()
    {
        if ($("#gpgSavePassword").is(':checked'))
        {
            chrome.storage.local.set(
            {
                'gpgPassword': $("#gpgPassword").val()
            }, function ()
            {
                rush.gpgPassword = $("#gpgPassword").val();
            });
        }
        else
        {
            chrome.storage.local.set(
            {
                'gpgPassword': ""
            }, function ()
            {
                rush.gpgPassword = "";
            });
        }

    },
    "decryptBIP38": function ()
    {
        Bitcoin.BIP38.EncryptedKeyToByteArrayAsync("6PfM14UF3DDa5e7TnzxyQg7iYr2VsvhyxU9LMTsTxaQiWo7ejkJscp1V3v", "poop", 
            function(privateKeyByteArray, isCompPoint) 
            {
                if (privateKeyByteArray != null && privateKeyByteArray.length > 0) {
                    var btc = new Bitcoin.ECKey(privateKeyByteArray);
                    console.log(isCompPoint ? btc.getBitcoinWalletImportFormatCompressed() : btc.getBitcoinWalletImportFormat());
                    console.log(isCompPoint ? btc.getBitcoinAddressCompressed() : btc.getBitcoinAddress()); 
                } else {
                    setMsg('Invalid encrypted key or passphrase');    
                } 
            } );
    },
    "gpgSendEncrypted": function ()
    {

        if (!this.gpgPrivate)
        {
            setGPGMsg("You must have a GPG key pair set before sending encrypted messages.")
            return;
        }

        if (!rush.gpgKeys.length)
        {
            setGPGMsg("You do not have any public keys imported. You can import using the 'Manage Keys' button.")
            return;
        }

        setGPGMsg("Please select recipient: <br/> <select id='gpgs' size='8'></select> <div><textarea id='gpgEncryptTxt' placeholder='Enter Message...'></textarea></div><input type='password' id='gpgPassword' placeholder='Password...'> <button id='keyboardBtn'><img src='keyboard.png'></button> <br/><input type='checkbox' id='gpgSavePassword'> <span class='savePasswordText'>Save Password</span> <br/> <button id='gpgConfirmSendEncrypted'>Send</button>")

        this.getCheck();

        for (var index in rush.gpgKeys)
        {

            $("#gpgs").append("<option value='" + index + "' user='" + htmlEncode(rush.gpgKeys[index].name) + "'>" + htmlEncode(rush.gpgKeys[index].name) + "</option>");

        }

        if (this.msgBuffer)
        {
            $("#gpgEncryptTxt").val(this.msgBuffer);
        }


        $('#gpgPassword').keyboard(
        {
            openOn: "",
            autoAccept: true,
            css:
            {
                input: ''
            }
        });

        $('#keyboardBtn').click(function ()
        {
            $('#gpgPassword').getkeyboard().reveal();
        });



    },
    "gpgConfirmSendEncrypted": function ()
    {


        var userID = $('#gpgs').val();

        if (userID == null)
        {
            return;
        }

        $("#gpgConfirmSendEncrypted").html("Sending...").attr("disabled", "disabled");


        openpgp.init();

        var publicKeyTxt = rush.gpgKeys[userID].key;

        var publicKey = openpgp.read_publicKey(publicKeyTxt);

        var privateKey = openpgp.read_privateKey(this.gpgPrivate);

        var keyid = s2hex(publicKey[0].publicKeyPacket.getKeyId());

        var myPublicKey = openpgp.read_publicKey(this.gpgPublic);

        var fromKeyId = s2hex(myPublicKey[0].publicKeyPacket.getKeyId());

        // var encrypted = openpgp.write_encrypted_message( openpgp.read_publicKey( this.gpgKeys[userID].key ), $("#gpgEncryptTxt").val() );

        if (!privateKey[0].decryptSecretMPIs($('#gpgPassword').val()))
        {
            $("#gpgConfirmSendEncrypted").html("Wrong Password!").removeAttr("disabled");
            setTimeout(function ()
            {
                $("#gpgConfirmSendEncrypted").html("Wrong Password").html("Send");
            }, 2000);

            return;
        }

        var encrypted = openpgp.write_signed_and_encrypted_message(privateKey[0], publicKey, $("#gpgEncryptTxt").val());

        $.ajax(
        {
            url: "http://rush.rubixapps.com/gpg.php",
            data:
            {
                "function": "sendMessage",
                "text": encrypted,
                "keyid": keyid,
                "fromkeyid": fromKeyId,
                "publickey": publicKeyTxt
            },

            type: "POST",
            success: function (res)
            {
                setGPGMsg("Message Sent!");

            },
            error: function (xhr, opt, err)
            {
                console.log("error!");
            }
        });
    },
    "gpgGetMessages": function ()
    {

        openpgp.init();

        var publicKey = openpgp.read_publicKey(this.gpgPublic);

        var keyid = s2hex(publicKey[0].publicKeyPacket.getKeyId());

        $.ajax(
        {
            url: "http://rush.rubixapps.com/gpg.php",
            data:
            {
                "function": "verifyGetMessages",
                "keyid": keyid
            },
            dataType: "json",
            type: "POST",
            success: function (res)
            {
                if (res.status == "OK")
                {
                    setGPGMsg("<div>Please enter password to retrieve messages: <br/><input id='gpgPassword' type='password' placeholder='Password' class='getMessages'> <button id='keyboardBtn'><img src='keyboard.png'></button></div> <input type='checkbox' id='gpgSavePassword'> <span class='savePasswordText'>Save Password</span> <br/><button id='gpgVerifyGetMessages' secret='" + res.secret + "'>Get Messages</button>")

                    rush.getCheck();

                    $('#gpgPassword').keyboard(
                    {
                        openOn: "",
                        autoAccept: true,
                        css:
                        {
                            input: ''
                        }
                    });

                    $('#keyboardBtn').click(function ()
                    {
                        $('#gpgPassword').getkeyboard().reveal();
                    });

                    $("#gpgPassword").focus();

                }
                else
                {
                    setGPGMsg("You have no new messages!");
                }

            },
            error: function (xhr, opt, err)
            {
                setGPGMsg("There was an error!");
            }
        });
    },
    "gpgVerifyGetMessages": function (secret)
    {

        $("#gpgVerifyGetMessages").html("Receiving...");
        $("#gpgVerifyGetMessages").attr("disabled", "disabled");
        openpgp.init();

        privateKey = openpgp.read_privateKey(this.gpgPrivate);

        var publicKey = openpgp.read_publicKey(this.gpgPublic);

        var keyid = s2hex(publicKey[0].publicKeyPacket.getKeyId());

        if (!privateKey[0].decryptSecretMPIs($('#gpgPassword').val()))
        {
            setGPGMsg("Password for secrect key was incorrect!");
            return;
        }

        signed = openpgp.write_signed_message(privateKey[0], secret);

        $.ajax(
        {
            url: "http://rush.rubixapps.com/gpg.php",
            data:
            {
                "function": "getMessages",
                "keyid": keyid,
                "signed": signed
            },
            dataType: "json",
            type: "POST",
            success: function (res)
            {
                if (res.status == "OK")
                {
                    var messages = res.messages;

                    rush.prevSecret = secret;

                    chrome.storage.local.set(
                    {
                        'prevSecret': rush.prevSecret
                    }, function () {});

                    if (!messages.length)
                    {
                        setGPGMsg("No new messages!");
                        return;
                    }

                    for (index in messages)
                    {
                        var msg = openpgp.read_message(messages[index].text);

                        var key = openpgp.read_privateKey(rush.gpgPrivate);

                        var keymat = null;
                        var sesskey = null;
                        // Find the private (sub)key for the session key of the message
                        for (var i = 0; i < msg[0].sessionKeys.length; i++)
                        {
                            if (key[0].privateKeyPacket.publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes)
                            {
                                keymat = {
                                    key: key[0],
                                    keymaterial: key[0].privateKeyPacket
                                };
                                sesskey = msg[0].sessionKeys[i];
                                break;
                            }
                            for (var j = 0; j < key[0].subKeys.length; j++)
                            {
                                if (key[0].subKeys[j].publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes)
                                {
                                    keymat = {
                                        key: key[0],
                                        keymaterial: key[0].subKeys[j]
                                    };
                                    sesskey = msg[0].sessionKeys[i];
                                    break;
                                }
                            }
                        }

                        if (!keymat.keymaterial.decryptSecretMPIs($('#gpgPassword').val()))
                        {
                            setGPGMsg("Password for secret key was incorrect!");
                            return;

                        }

                        var verifyPublicKeyTxt = '';
                        var name = '';

                        for (k in rush.gpgKeys)
                        {
                            if (rush.gpgKeys[k].keyId == messages[index].from_keyid)
                            {
                                verifyPublicKeyTxt = rush.gpgKeys[k].key;
                                name = rush.gpgKeys[k].name;
                            }
                        }


                        if (!name)
                        {
                            var decrypted = msg[0].decrypt(keymat, sesskey);

                            rush.gpgMessages.unshift(
                            {
                                "name": "Unknown Sender",
                                "time": messages[index].timeTxt,
                                "message": decrypted,
                                "read": false
                            });
                        }
                        else
                        {
                            openpgp.keyring.importPublicKey(verifyPublicKeyTxt);

                            var decrypted = msg[0].decryptAndVerifySignature(keymat, sesskey);

                            if ((s2hex(decrypted.sigs[0].issuerKeyId) == messages[index].from_keyid))
                            {
                                rush.gpgMessages.unshift(
                                {
                                    "name": name,
                                    "time": "" + decrypted.sigs[0].creationTime,
                                    "message": decrypted.text,
                                    "read": false,
                                    "keyid": messages[index].from_keyid
                                });
                            }

                        }

                    }

                    chrome.storage.local.set(
                    {
                        'gpgMessages': rush.gpgMessages
                    }, function ()
                    {
                        rush.gpgListMessages();
                    });

                    //popupMsg( messagesHTML );
                    setGPGMsg("Messages Received!");

                    $("#msgCount").html("(0)");

                    chrome.storage.local.set(
                    {
                        'msgCount': 0
                    }, function (){});


                    chrome.browserAction.setBadgeText(
                    {
                        text: ""
                    });

                }
                else
                {
                    setGPGMsg("There was an error!");
                }

            },
            error: function (xhr, opt, err)
            {
                setGPGMsg("There was an error!");
            }
        });


    },
    "gpgListMessages": function ()
    {

        if (!this.gpgMessages.length)
        {
            $("#inbox").hide();
            $("#inboxTitle").hide();

            return;
        }

        $("#inbox").show();
        $("#inboxTitle").show();

        var listHtml = "<select id='messageList' size='6'>";

        var gpgMessages = rush.gpgMessages;

        for (index in gpgMessages)
        {

            var name = gpgMessages[index].name;


            name = name.replace(/\s<.+>/, "");

            var date = new Date(gpgMessages[index].time);

            date = date.format("MM/dd h:mmz");

            var subjectString = htmlEncode(name) + " " + date;

            if (!gpgMessages[index].read)
            {
                subjectString = "<span class='unread'>" + subjectString + "</span>";
                var className = "unread"
            }
            else
            {
                subjectString = "<span class='read'>" + subjectString + "</span>";
                var className = "read"

            }

            listHtml += "<option class='" + className + "' value='" + index + "'>" + subjectString + "</option>";
        }

        listHtml += "</select> <div id='messageControls'><button id='msgRead'>Read</button>  <button id='msgDel'>Delete</button></div>";

        $("#inbox").html(listHtml);

        $("#messageList").val(0);

    },
    "msgDel": function ()
    {
        // if ( !$("#msgDel").attr("confirmed") )
        // {
        //     $("#msgDel").html("Are you sure? Click to confirm!").attr("confirmed", "true");
        //     $("<button id='clearBox'>No</button>").insertAfter("#msgDel");
        //     return;
        // }

        var msgID = $('#messageList').val();

        if (typeof (msgID) == 'undefined')
        {
            return;
        }

        rush.gpgMessages.splice(msgID, 1);

        chrome.storage.local.set(
        {
            'gpgMessages': rush.gpgMessages
        }, function ()
        {

            setGPGMsg("Message removed!");

        });

        this.gpgListMessages();

    },
    "msgRead": function ()
    {

        var msgID = $('#messageList').val();

        this.gpgMessages[msgID].read = true;

        chrome.storage.local.set(
        {
            'gpgMessages': rush.gpgMessages
        }, function () {

        });

        var verifyString = "";

        if (this.gpgMessages[msgID].name != "Unknown Sender")
        {
            verifyString = "Verified from ";
        }

        var messageHTML = "<button id='msgReply' msgID='"+msgID+"'>Reply</button><hr/><b>" + verifyString + htmlEncode(this.gpgMessages[msgID].name) + "</b><br/>" + this.gpgMessages[msgID].time + "<br/><br/>" + htmlEncode(this.gpgMessages[msgID].message) + "";

        popupMsg(messageHTML);

        if ( $("#messageBox")[0].scrollHeight > 210 )
        {
            $("#messageBox").append('<br/><br/><button id="msgReply" msgID="'+msgID+'">Reply</button>');
        }

    },
    "msgReply": function ( msgID )
    {

        //var msgID = $('#messageList').val();

        // this.gpgMessages[msgID].read = true;  

        // chrome.storage.local.set({
        //     'gpgMessages'       : rush.gpgMessages
        // }, function () {

        // });      

        var verifyString = "";

        if (this.gpgMessages[msgID].name != "Unknown Sender")
        {
            verifyString = "Verified from ";
        }

        for (var i = 0; i < this.gpgKeys.length; i++)
        {
            console.log(this.gpgKeys[i].keyId + " " + this.gpgMessages[msgID].keyid);

            if (this.gpgKeys[i].keyId == this.gpgMessages[msgID].keyid)
            {
                index = i;
                break;
            }
        }


        if (index)
        {

            console.log(index);

            setTimeout(function ()
            {
                $("#gpgs").val(index);
            }, 100);

        }

        var messageHTML = verifyString + this.gpgMessages[msgID].name + "\n" + this.gpgMessages[msgID].time + "\n\n" + this.gpgMessages[msgID].message + "";

        this.gpgSendEncrypted();

        $("#gpgEncryptTxt").val("\n\n----------------------\n" + messageHTML);

        $("#gpgEncryptTxt").focus();

    },
    "gpgManage": function ()
    {

        if (rush.gpgKeys.length == 0)
        {
            setGPGMsg("You have no imported public keys!");
            return;
        }

        setGPGMsg('Manage Keys:<br/>    <select id="gpgs" size="2"></select> <button id="gpgDelete">Delete Key</button> <button id="gpgExportPublic">Export Key</button>');

        for (var index in rush.gpgKeys)
        {

            $("#gpgs").append("<option value='" + index + "' user='" + htmlEncode(rush.gpgKeys[index].name) + "'>" + htmlEncode(rush.gpgKeys[index].name) + "</option>");

        }

    },
    "gpgDelete": function ()
    {

        if (!$("#gpgDelete").attr("confirmed"))
        {
            $("#gpgDelete").html("Are you sure? Click to confirm!").attr("confirmed", "true");
            $("<button id='clearBox'>No</button>").insertAfter("#gpgDelete");
            return;
        }

        var userID = $('#gpgs').val();

        if (userID == null)
        {
            setGPGMsg("You must select a key!");
            return;
        }

        rush.gpgKeys.splice(userID, 1);

        chrome.storage.local.set(
        {
            'gpgKeys': rush.gpgKeys
        }, function ()
        {

            setGPGMsg("Key removed!");

        });
    },
    "gpgExportPublic": function ()
    {
        var userID = $('#gpgs').val();

        if (userID == null)
        {
            setGPGMsg("You must select a key!");
            return;
        }

        popup(this.gpgKeys[userID].key);
    },
    "gpgExport": function ()
    {
        setGPGMsg('<textarea id="gpgBox" readonly></textarea><br/><button id="shareKey" share="mailto:?subject=' + encodeURIComponent("Heres my public GPG key!") + '&body=' + encodeURIComponent( this.gpgPublic ) + '">E-mail Key</button>');

        $("#gpgBox").val(this.gpgPublic);

        // popup(rush.gpgPublic);
    },
    "gpgExportPrivate": function ()
    {
        popup(rush.gpgPrivate);
    },
    "showSettings": function ()
    {
        $("#showSettings").hide();
        $("#tools").show();
    },
    "gpgShowSettings": function ()
    {
        $("#gpgShowSettings").hide();
        $("#gpgTools").show();
    },
    "gpgDecrypt": function ()
    {
        if (!this.gpgPrivate)
        {
            setGPGMsg("You do not have a private GPG key on file! Pease import or create one.");
            return;
        }

        setGPGMsg("<div><input id='gpgPassword' type='password' placeholder='Password'> <button id='keyboardBtn'><img src='keyboard.png'/></button><br/><input type='checkbox' id='gpgSavePassword'> <span class='savePasswordText'>Save Password</span><br/><textarea id='gpgDecryptTxt' placeholder='Message to decrypt...'></textarea></div> <button id='gpgConfirmDecrypt'>Decrypt</button>");

        this.getCheck();

        $("#gpgPassword").focus();


        $('#gpgPassword').keyboard(
        {
            openOn: "",
            autoAccept: true,
            css:
            {
                input: ''
            }
        });

        $('#keyboardBtn').click(function ()
        {
            $('#gpgPassword').getkeyboard().reveal();
        });

    },
    "gpgConfirmDecrypt": function ()
    {
        openpgp.init();

        var msg = openpgp.read_message($("#gpgDecryptTxt").val());

        var key = openpgp.read_privateKey(this.gpgPrivate);

        var keymat = null;
        var sesskey = null;
        // Find the private (sub)key for the session key of the message
        for (var i = 0; i < msg[0].sessionKeys.length; i++)
        {
            if (key[0].privateKeyPacket.publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes)
            {
                keymat = {
                    key: key[0],
                    keymaterial: key[0].privateKeyPacket
                };
                sesskey = msg[0].sessionKeys[i];
                break;
            }
            for (var j = 0; j < key[0].subKeys.length; j++)
            {
                if (key[0].subKeys[j].publicKey.getKeyId() == msg[0].sessionKeys[i].keyId.bytes)
                {
                    keymat = {
                        key: key[0],
                        keymaterial: key[0].subKeys[j]
                    };
                    sesskey = msg[0].sessionKeys[i];
                    break;
                }
            }
        }

        if (!keymat.keymaterial.decryptSecretMPIs($('#gpgPassword').val()))
        {
            setGPGMsg("Password for secret key was incorrect!");
            return;

        }

        var decrypted = msg[0].decrypt(keymat, sesskey);

        //setGPGMsg( "Message decrypted!" );

        popup(decrypted);


    },
    "setNews": function()
    {
        setSettingsMsg("<div>Select your news source: <br/><select id='newsType'></select> ")

        setTimeout( function () {
        for ( i in rush.newsOptions )
        {
            $("#newsType").append( "<option value='" + (parseInt(i)+1) + "'>" + rush.newsOptions[i] + "</option>" );
        }

        $("#newsType").val( rush.newsType );

    }, 100);

    },
    "setNewsConfirm": function ()
    {
        newsType = $("#newsType").val();
        this.newsType = newsType;

        chrome.storage.local.set(
        {
            'newsType': newsType
        }, function () {

        });

        setSettingsMsg( "News source succesfully changed!");

    },
    "setCurrency": function()
    {
        setSettingsMsg("<div>Select the currency you wish to change to: <br/><select id='currencies'></select> ")

        for ( i in this.currencyOptions )
        {
            $("#currencies").append( "<option value='" + this.currencyOptions[i] + "'>" + this.currencyOptions[i] + "</option>" );
        }

        $("#currencies").val( this.currency );
    },
    "setCurrencyConfirm": function ()
    {
        currency = $("#currencies").val();
        this.currency = currency;

        chrome.storage.local.set(
        {
            'currency': currency
        }, function () {

            rush.getFiatPrice();    

        });

        $("#priceSrc").html( currency );

        setSettingsMsg( "Currency succesfully changed!");

    },
    "getFiatPrefix": function()
    {
        switch ( this.currency )
        {
            case "AUD":
            case "USD":
            case "CAD":
                return "$";
                break;
            default:
                return "";
        }
    },
    "loadDonateOptions": function( )
    {
        this.openTab("donate");

        $("#donatePage").html('<div class="title">Donate Bitcoins</div> <div class="settings" id="donateOptions"></div>');

        for ( i in this.donateOptions )
        {
            $("#donateOptions").append('<a href="#" class="donateLink" donateID="' + i + '">' + this.donateOptions[i][0] + '</a></a>');   
        }

    },
    "prepareDonate": function( donateID )
    {
        $("#donatePage").html('<div class="title">Donate to ' + this.donateOptions[donateID][0] + '</div> <div class="donateSiteLink" link="' + this.donateOptions[donateID][2] + '"><a href="#">' + this.donateOptions[donateID][2] + '</a></div><div class="settings" id="donateAmounts"></div>');

        var amounts = [ 1, 5, 10, 20, 50, 100 ];

        for ( i in amounts )
        {
            $("#donateAmounts").append('<a href="#" class="donateNow" addr="' + this.donateOptions[donateID][1] + '" amount="' + amounts[i] + '">Donate ' + rush.getFiatPrefix() + amounts[i] + '</a>');   
        }

        $("#donateAmounts").append('<a href="#" class="donateNow" addr="' + this.donateOptions[donateID][1] + '" amount="0">Custom Donation</a>');   

    },
    "donate": function ( donateBtn )
    {
        rush.openTab("wallet");

        var dollarAmount = $(donateBtn).attr("amount");

        var btcAmount = dollarAmount / this.price;

        $("#txtAddress").val( $(donateBtn).attr("addr") );
        $("#txtAmount").val( btcAmount.toFixed(8) );

        if ( !btcAmount )
        {
            $("#txtAmount").val( "" ).focus();
        }

        this.amountFiatValue();
    },
    "getCharts": function()
    {
        this.get24Chart();
        this.get30Chart();
    },
    "get24Chart": function() 
    {
        $.ajax({
           type: "GET",
           url: "https://api.bitcoinaverage.com/history/" + rush.currency + "/per_minute_24h_sliding_window.csv",
           dataType: "text",
           success: function(allText) 
            {
                var allTextLines = allText.split(/\r\n|\n/);
                var headers = allTextLines[0].split(',');
                var lines = [];

                for (var i=1; i<allTextLines.length; i++) {
                    var data = allTextLines[i].split(',');
                    if (data.length == headers.length) {

                        var tarr = [];
                        for (var j=0; j<headers.length; j++) {
                            tarr.push(data[j]);
                        }
                        lines.push(tarr);
                    }
                }


                hours = [];

                for ( i in lines )
                {
                    if ( i % 2 == 0 )
                    {

                        var date = new Date( lines[i][0] + " GMT");

                        unix = date.getTime()  ;

                        hours.push( [unix, lines[i][1] ] );
                    }
                    

                }


                $.plot("#chart24", [ hours ],
                    {       
                           xaxis: {mode:"time", timeformat: "%H", timezone: "browser", tickSize: [3, "hour"]},
                           colors: ["#0D88CE"]
                   }

                );

            }


        });
    },
    "get30Chart": function ()
    {
        $.ajax({
           type: "GET",
           url: "https://api.bitcoinaverage.com/history/" + rush.currency + "/per_hour_monthly_sliding_window.csv",
           dataType: "text",
           success: function(allText) 
            {
                var allTextLines = allText.split(/\r\n|\n/);
                var headers = allTextLines[0].split(',');
                var lines = [];

                for (var i=1; i<allTextLines.length; i++) {
                    var data = allTextLines[i].split(',');
                    if (data.length == headers.length) {

                        var tarr = [];
                        for (var j=0; j<headers.length; j++) {
                            tarr.push(data[j]);
                        }
                        lines.push(tarr);
                    }
                }


                hours = [];

                for ( i in lines )
                {
                    if ( i % 2 == 0 )
                    {

                        var date = new Date( lines[i][0] + " GMT");

                        unix = date.getTime()  ;

                        hours.push( [unix, lines[i][1] ] );
                    }
                    

                }


                $.plot("#chart30", [ hours ],
                    {       
                           xaxis: {mode:"time", timeformat: "%e", timezone: "browser", tickSize: [3, "day"]},
                           colors: ["#0D88CE"]
                   }

                );

            }


        });
    }


};

function popup(txt)
{
    setGPGMsg('<textarea id="gpgBox" readonly></textarea>');

    $("#gpgBox").val(txt);
}

function popupMsg(txt)
{
    // txt = txt.replace(/\n/g, '<br />');
    setGPGMsg('<div id="messageBox">' + txt + '</div>');
}


$(document).ready(function ()
{

    var code = window.location.hash;

    chrome.storage.local.get(["code", "address", "password", "encrypted", "gpgPublic", "gpgPrivate", "gpgKeys", "msgCount", "gpgMessages", "gpgPassword", "msgBuffer", "price", "lastTab", "currency", "newsType"], function (data)
    {

        if ( data.msgCount != undefined)
        {
            $("#msgCount").html("(" + data.msgCount + ")");
        }

        if ( data.lastTab )
        {
            rush.lastTab = data.lastTab;
        }

        if ( data.currency )
        {
            rush.currency = data.currency;

            $("#priceSrc").html( data.currency );
        }

        if (data.gpgMessages)
        {
            rush.gpgMessages = data.gpgMessages;
        }

        if (data.newsType)
        {
            rush.newsType = data.newsType;
        }

        if (data.msgBuffer)
        {
            rush.msgBuffer = data.msgBuffer;
        }

        if (data.price)
        {
            rush.price = data.price;
        }

        if (data.encrypted)
        {
            rush.encrypted = data.encrypted;
        }

        if (data.address)
        {
            rush.address = data.address;
        }

        if (data.gpgPassword)
        {
            rush.gpgPassword = data.gpgPassword;
        }

        if (data.gpgKeys)
        {
            rush.gpgKeys = data.gpgKeys;

            rush.gpgKeys.sort(function (a, b)
            {
                return (a.name.toUpperCase() < b.name.toUpperCase()) ? -1 : 1;
            });
        }

        if (data.code)
        {
            code = data.code;
        }

        if (data.gpgPublic)
        {
            rush.gpgPublic = data.gpgPublic;

            $("#gpgCreate").html("Reset Your GPG Keys");
            // $("#gpgImportPrivate").hide();
        }

        if (data.gpgPrivate)
        {
            rush.gpgPrivate = data.gpgPrivate;
        }

        if (code)
        {
            rush.passcode = code;

            rush.open();
        }
        else
        {
            entroMouse.start();
        }

    });
});

Date.prototype.format = function (format) //author: meizz
{
    var o = {
        "M+": this.getMonth() + 1, //month
        "d+": this.getDate(), //day
        "H+": this.getHours(), //hour
        "h+": ((this.getHours() % 12)==0)?"12":(this.getHours() % 12), //hour
        "z+": ( this.getHours()>11 )?"pm":"am", //hour
        "m+": this.getMinutes(), //minute
        "s+": this.getSeconds(), //second
        "q+": Math.floor((this.getMonth() + 3) / 3), //quarter
        "S": this.getMilliseconds() //millisecond
    }

    if (/(y+)/.test(format)) format = format.replace(RegExp.$1, (this.getFullYear() + "").substr(4 - RegExp.$1.length));
    for (var k in o)
        if (new RegExp("(" + k + ")").test(format))
            format = format.replace(RegExp.$1,
                RegExp.$1.length == 1 ? o[k] :
                ("00" + o[k]).substr(("" + o[k]).length));
    return format;
}

function formatMoney(x)
{
    return x.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function htmlEncode(value)
{
    //create a in-memory div, set it's inner text(which jQuery automatically encodes)
    //then grab the encoded contents back out.  The div never exists on the page.
    return $('<div/>').text(value).html();
}

function s2hex(s)
{
    return Bitcoin.convert.bytesToHex(Bitcoin.convert.stringToBytes(s))
}

function playBeep()
{
    var snd = document.getElementById('noise');
    //canPlayMP3 = (typeof snd.canPlayType === "function" && snd.canPlayType("audio/mpeg") !== "");
    snd.src = 'balance.wav';
    snd.load();
    snd.play();
}

function ajax(url,success,data) {
    var xhr = new XMLHttpRequest();
    xhr.onreadystatechange = function () {
        if (xhr.readyState == 4) {
            success(xhr.responseText);
            xhr.close;
        }
    }
    xhr.open(data ? "POST" : "GET", url, true);
    if (data) xhr.setRequestHeader('Content-type', 'application/x-www-form-urlencoded');
    xhr.send(data);
}

function tx_fetch(url, onSuccess, onError, postdata)
{
    $.ajax(
    {
        url: url,
        data: postdata || '',
        type: "POST",
        success: function (res)
        {
            onSuccess(JSON.stringify(res));

        },
        error: function (xhr, opt, err)
        {
            console.log("error!");
        }
    });
}
