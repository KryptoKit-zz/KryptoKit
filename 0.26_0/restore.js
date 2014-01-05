window.onload = function ()
{
    document.getElementById('restoreFile').addEventListener('change', restore, false);
}

function restore()
{
    var files = document.getElementById('restoreFile').files;
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

            if (!restore.address)
            {
                setMsg("Doesnt seem to be a backup file!");
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
                setMsg("Backup restored succesfully! You may now reopen the extension and close this window.");

            });

        };
    })(f);

    reader.readAsText(f, 'UTF-8');
}

function setMsg(msg)
{
    $("#resultBox").html(msg);
}