async function getWordsLan(words){
  const cache = await self.caches.open("tt-lang-packs-v17");
  const request = new Request("https://web.telegram.org/z/en");
  const response = await cache.match(request);
  const text = await response.text()
  const body = JSON.parse(text)

  const items = {}
  for (let i = 0; i < words.length; i++) {
    items[words[i]] = body[words[i]];
  }
  return items
}

const words =  ["lng_settings_disable_night_theme","AccDescrOpenMenu2","Common.Close","全部","ChatList.Filter.AddToFolder","ReportPeer.Report","AccDescrReactionMentionDown","GroupInfo.Title","lng_sure_logout","AccountSettings.Logout","Wai","EnablePasscode","ShortcutsController.Others.LockByPasscode","Passcode.EnterPasscodePlaceholder","Chat.EmptyChat","GiftTelegramPremiumTitle","GiftTelegramPremiumDescription","GiftPremiumListFeaturesAndTerms","GiftSubscriptionFor","WebApp.ReloadPage","lng_call_status_exchanging","AccSwitchToFullscreen","lng_call_unmute_audio","lng_call_start_video","lng_call_screencast","lng_call_end_call","lng_call_rate_label","lng_call_rate_comment","BotOpenPageTitle","BotOpenPageMessage","WebApp.AddToAttachmentText"]
JSON.stringify(await getWordsLan(words))


