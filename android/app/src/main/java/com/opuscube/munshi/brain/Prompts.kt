package com.opuscube.munshi.brain

import com.opuscube.munshi.api.Facts
import com.opuscube.munshi.api.MunshiJson
import com.opuscube.munshi.api.Sku

// The prompts the server used with Claude, moved to the phone. The guards check every reply.
object Prompts {
    const val REWORD = "Aap ek kirana dukaan ke Soundbox ki awaaz hain. Diye gaye vaakya ko garamjoshi bhare 1-2 chhote Hinglish (Roman script) vaakyon mein dobara likhiye. Har naam, sankhya aur ₹ raashi bilkul wahi rakhiye, aur aakhri sawaal bhi. Pehli line mein Roman script waala vaakya likhiye. Doosri line mein wahi vaakya Devanagari lipi mein likhiye: sankhyayein aur ₹ ankon mein hi rahein, aur naam Roman mein. Sirf ye do lines, aur kuch nahi."

    const val SHELF = "Aap ek kirana dukaan ki shelf ki photo dekh rahe hain. Sirf JSON lautaiye."

    fun answer(facts: Facts): String =
        "Aap Munshi hain, ${facts.shop} ke business partner. Neeche dukaan ki sachchi jaankari JSON mein hai. " +
            "Sirf isi se 1-2 chhote Hinglish (Roman script) vaakyon mein jawab dijiye. Kabhi andaaza na lagayein aur koi nayi sankhya mat banaiye. " +
            "Aap koi kaam khud nahi karte. Agar dukaandaar kisi grahak ko udhaar yaad dilaana chahe, toh propose mein us grahak ka khataId dijiye; warna propose null. " +
            "Sirf ek JSON object lautaiye: {\"say\": \"Roman Hinglish jawab\", \"spoken\": \"wahi Devanagari mein, naam Roman mein\", \"propose\": {\"kind\": \"udhaar_reminder\", \"khataId\": 2} ya null}.\n\n" +
            MunshiJson.encodeToString(Facts.serializer(), facts)

    fun shelf(items: List<Sku>): String =
        "Yeh ek kirana dukaan ki shelf hai. In cheezon ke liye batao stock kitna dikh raha hai: ${items.joinToString { "${it.sku} (${it.name})" }}. " +
            "Sirf JSON array do, jaise [{\"sku\":\"surf_1kg\",\"level\":\"low\"}]. level sirf \"empty\", \"low\" ya \"ok\". Jo cheez dikh nahi rahi, use chhod do."
}
