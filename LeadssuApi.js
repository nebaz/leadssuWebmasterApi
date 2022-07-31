const fetch = require('node-fetch');
const API_URL = 'https://api.leads.su/webmaster/';
const STATUS_REJECTED = 'rejected';
const STATUS_OPEN = 'open';
const STATUS_APPROVED = 'approved';

class LeadssuApi {

  static STATUS_REJECTED = STATUS_REJECTED;
  static STATUS_OPEN = STATUS_OPEN;
  static STATUS_APPROVED = STATUS_APPROVED;

  constructor(webmasterToken) {
    this.token = webmasterToken;
  }

  async getProfile() {
    let profile = await this.apiRequest('account');
    return profile?.data;
  }

  async getBalance() {
    let data = await this.apiRequest('account/balance');
    if (!data.data) {
      return false;
    }
    return {
      mainBalance: Number(data.data.balance),
      holdAdv: Number(data.data.hold),
      availableBalance: Number(data.data.available_balance),
      withdrawal: Number(data.data.ordered),
      withdrawn: Number(data.data.paid)
    }
  }

  async getTrafficChannels() {
    let data = await this.apiRequest('platforms');
    if (data.data && Array.isArray(data.data)) {
      return data.data.map(it => ({
        id: Number(it.id),
        name: it.name
      }));
    }
    return [];
  }

  async getOffersData(offerId, channelId) {
    let action = 'offers';
    let params = new Map();
    if (offerId) {
      if (Array.isArray(offerId)) {
        params.set('ids', offerId);
      } else {
        params.set('id', offerId);
      }
    }
    if (channelId) {
      action = 'offers/connectedPlatforms';
      params.set('platform_id', channelId);
    }
    let result = [];
    let offset = 0;
    let limit = 500;
    let apiData;
    do {
      params.set('offset', offset);
      params.set('limit', limit);
      apiData = await this.apiRequest(action, params);
      if (!apiData) {
        return false;
      }
      result = result.concat(result, apiData.data);
      offset += limit;
    } while (offset < apiData.count)
    return result;
  }

  async getLeadsByOfferId(dateFrom, dateTo, offerId = null, channelId = null) {
    dateFrom = this.#formatDate(dateFrom);
    dateTo = this.#formatDate(dateTo);
    let action = 'conversions';
    let params = new Map();
    params.set('start_date', dateFrom);
    params.set('end_date', dateTo);
    if (offerId) {
      params.set('offer_id', offerId);
    }
    if (channelId) {
      params.set('platform_id', channelId);
    }
    let result = [];
    let offset = 0;
    let limit = 500;
    let apiData;
    do {
      params.set('offset', offset);
      params.set('limit', limit);
      apiData = await this.apiRequest(action, params);
      if (apiData && Array.isArray(apiData.data) && apiData.data.length) {
        apiData.data.map(it => {
          it.orderId = it.id;
          it.offerId = it.offer_id;
          it.status = this.#getLeadStatus(it.status);
          it.commission = it.payout;
          it.subaccount = it.aff_sub1;
          it.subaccount2 = it.aff_sub2;
          it.leadTime = new Date(it.created).valueOf();
        });
        result = result.concat(apiData.data);
      }
      offset += limit;
    } while (offset < apiData.count)
    return result;
  }

  /**
   * short grouped statistics by offer and chanel
   * @return Array {offerId,clicks,leadsOpen,commissionOpen,...}
   */
  async getStatisticsOffers(dateFrom, dateTo, offerId = null, channelId = null, subid = null, group = 'year', subgroup = null) {
    dateFrom = this.#formatDate(dateFrom);
    dateTo = this.#formatDate(dateTo);
    let action = 'reports/summary';
    let params = new Map();
    if (offerId) {
      params.set('offer_id', offerId);
    }
    if (channelId) {
      params.set('platform_id', channelId);
    }
    if (subid) {
      params.set('aff_sub1', subid);
    }
    if (subgroup) {
      params.set('fields', subgroup);
    }
    params.set('start_date', dateFrom);
    params.set('end_date', dateTo);
    params.set('grouping', group);
    params.set('limit', 500);
    let result = [];
    let apiData = await this.apiRequest(action, params);
    if (apiData && Array.isArray(apiData.data)) {
      result = result.concat(apiData.data.map(it => ({
        offerId: Number(it.offer_id),
        offerName: it.offer_name,
        clicks: it.clicks || 0,
        leads: it.conversions || 0,
        leadsRejected: it.conversions_rejected || 0,
        leadsOpen: it.conversions_pending || 0,
        leadsApproved: it.conversions_approved || 0,
        commissionOpen: it.pending_payout || 0,
        commissionApproved: it.payout || 0,
        cr: it.clicks ? Math.round(it.conversions / it.clicks * 10000) / 100 : 0,
        ar: it.conversions ? Math.round(it.conversions_approved / it.conversions * 10000) / 100 : 0
      })));
    }
    return result;
  }

  async getWebmasterCommissions(dateFrom, dateTo, offerId = null) {
    let stats = await this.getStatisticsOffers(dateFrom, dateTo, offerId);
    let commissionRejected = 0;
    let commissionOpen = 0;
    let commissionApproved = 0;
    for (let item of stats) {
      commissionRejected = Number((commissionRejected + item.commissionRejected).toFixed(2));
      commissionOpen = Number((commissionOpen + item.commissionOpen).toFixed(2));
      commissionApproved = Number((commissionApproved + item.commissionApproved).toFixed(2));
    }
    return {commissionRejected, commissionOpen, commissionApproved};
  }

  async getOfferLinkByOfferId(offerId, channelId) {
    let offerData = (await this.getOffersData(offerId, channelId))[0];
    if (!offerData) {
      return null;
    }
    return 'https://pxl.leads.su/aff_c?offer_id=' + offerId + '&pltfm_id=' + channelId;
  }

  #formatDate(timestamp) {
    let mm = new Date(timestamp).getMonth() + 1;
    let dd = new Date(timestamp).getDate();
    return [new Date(timestamp).getFullYear(), (mm > 9 ? '' : '0') + mm, (dd > 9 ? '' : '0') + dd].join('-');
  }

  #getLeadStatus(status) {
    switch (status) {
      case 'rejected':
        return STATUS_REJECTED;
      case 'pending':
        return STATUS_OPEN;
      case 'approved':
        return STATUS_APPROVED;
      default:
        return status;
    }
  }

  async apiRequest(action, params = new Map()) {
    params.set('token', this.token)
    let url = new URL(action, API_URL).toString() + '?';
    for (let [key, value] of params) {
      url += key + '=' + (Array.isArray(value) ? JSON.stringify(value) : value) + '&';
    }
    // console.info('LeadssuApiRequest', new Date().toLocaleString(), url);
    let result;
    try {
      result = await (await fetch(url)).json();
    } catch (e) {
      console.error('leads.su api error', e);
      return false;
    }
    // console.info('LeadssuApiResult', new Date().toLocaleString(), result);
    if (!result.error && result.code === 200 && result.data) {
      return result;
    }
    return false;
  }

}

module.exports = LeadssuApi;
