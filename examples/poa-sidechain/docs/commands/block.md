# `poa-sidechain block`

Commands relating to poa-sidechain blocks.

- [`poa-sidechain block get INPUT`](#poa-sidechain-block-get-input)

## `poa-sidechain block get INPUT`

Get block information for a given id or height.

```
USAGE
  $ poa-sidechain block get INPUT [-d <value>] [--pretty]

ARGUMENTS
  INPUT  Height in number or block id in hex format.

FLAGS
  -d, --data-path=<value>  Directory path to specify where node data is stored. Environment variable "KLAYR_DATA_PATH"
                           can also be used.
      --pretty             Prints JSON in pretty format rather than condensed.

DESCRIPTION
  Get block information for a given id or height.

EXAMPLES
  block:get e082e79d01016632c451c9df9276e486cb7f460dc793ff5b10d8f71eecec28b4

  block:get 2
```
