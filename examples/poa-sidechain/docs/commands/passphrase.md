# `poa-sidechain passphrase`

Commands relating to poa-sidechain passphrases.

- [`poa-sidechain passphrase create`](#poa-sidechain-passphrase-create)
- [`poa-sidechain passphrase decrypt`](#poa-sidechain-passphrase-decrypt)
- [`poa-sidechain passphrase encrypt`](#poa-sidechain-passphrase-encrypt)

## `poa-sidechain passphrase create`

Returns a randomly generated 24 words mnemonic passphrase.

```
USAGE
  $ poa-sidechain passphrase create [-o <value>]

FLAGS
  -o, --output=<value>  The output directory. Default will set to current working directory.

DESCRIPTION
  Returns a randomly generated 24 words mnemonic passphrase.

EXAMPLES
  passphrase:create

  passphrase:create --output /mypath/passphrase.json
```

## `poa-sidechain passphrase decrypt`

Decrypt secret passphrase using the password provided at the time of encryption.

```
USAGE
  $ poa-sidechain passphrase decrypt -f <value> [-w <value>]

FLAGS
  -f, --file-path=<value>  (required) Path of the file to import from
  -w, --password=<value>   Specifies a source for your secret password. Command will prompt you for input if this option
                           is not set.
                           Examples:
                           - --password=pass:password123 (should only be used where security is not important)

DESCRIPTION
  Decrypt secret passphrase using the password provided at the time of encryption.

EXAMPLES
  passphrase:decrypt --file-path ./my/path/output.json

  passphrase:decrypt --file-path ./my/path/output.json --password your-password
```

## `poa-sidechain passphrase encrypt`

Encrypt secret passphrase using password.

```
USAGE
  $ poa-sidechain passphrase encrypt [-w <value>] [-p <value>] [--output-public-key] [-o <value>]

FLAGS
  -o, --output=<value>      The output directory. Default will set to current working directory.
  -p, --passphrase=<value>  Specifies a source for your secret passphrase. Command will prompt you for input if this
                            option is not set.
                            Examples:
                            - --passphrase='my secret passphrase' (should only be used where security is not important)
  -w, --password=<value>    Specifies a source for your secret password. Command will prompt you for input if this
                            option is not set.
                            Examples:
                            - --password=pass:password123 (should only be used where security is not important)
      --output-public-key   Includes the public key in the output. This option is provided for the convenience of node
                            operators.

DESCRIPTION
  Encrypt secret passphrase using password.

EXAMPLES
  passphrase:encrypt

  passphrase:encrypt --passphrase your-passphrase --output /mypath/keys.json

  passphrase:encrypt --password your-password

  passphrase:encrypt --password your-password --passphrase your-passphrase --output /mypath/keys.json

  passphrase:encrypt --output-public-key --output /mypath/keys.json
```
