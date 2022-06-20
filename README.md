# leads.su API Integration

## Installation

To use the library, install it through [npm](https://npmjs.com)

```shell
npm install --save leadssu-webmaster-api
```

## Get API token
* https://webmaster.leads.su/account/default

## Usage
    const LeadssuApi = require('leadssu-webmaster-api');
    const api = new LeadssuApi(token);
    let profile = await api.getProfile();

## API
* getProfile(): Object
* getBalance(): Object
* getTrafficChannels(): Array< Object >
* getOffersData(int offerId?, int channelId?): Array< Object >
* getLeadsByOfferId(timestamp dateFrom, timestamp dateTo, int offerId?, int channelId?): Array< Object >
* getStatisticsOffers(timestamp dateFrom, timestamp dateTo, int offerId?, int channelId?, string subid?, string group?, string subgroup?): Array< Object >
* getWebmasterCommissions(timestamp dateFrom, timestamp dateTo, int offerId?): Object
* getOfferLinkByOfferId(int offerId, int channelId): String
* apiRequest(action, params) - native leads.su api request
