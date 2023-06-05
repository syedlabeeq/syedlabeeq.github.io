---
layout: post
title: "Releasing Damn Vulnerable Electron App: A playground to learn electronJS security vulnerabilties"
tags:
  - DVEA
  - Electron JS
author: "Najam Ul Saqib"
comments: true
description: "Learn about security vulnerabilities in Electron apps with DVEA, a Damn Vulnerable Electron App developed for educational purposes. DVEA is an open-source app intentionally built with vulnerabilities to help educate developers about the types of security vulnerabilities that can occur in Electron apps and how to prevent them. Download the app from GitHub and get started learning about secure coding practices today."
---
<p align="center">
<img src="/assets/images/posts/releasing-dvea/Electron-logo-light.png" >
</p>

### What is Electron JS?
ElectronJS is a popular open-source framework for building cross-platform desktop applications using web technologies such as JavaScript, HTML, and CSS. With Electron, developers can build native desktop apps that run on Windows, macOS, and Linux using a single codebase.

### Why DVEA?
As a developer and security engineer, I found that there is no vulnerable app for learning about security vulnerabilities in Electron apps. While there are many resources available for learning about vulnerabilities in other platforms, the list can be found on [OWASP Vulnerable Web Applications Directory](https://owasp.org/www-project-vulnerable-web-applications-directory/), there was no playground for learning about Electron security issues.

I was trying to learn electron security and how these apps are developed so I decided to work on DVEA, here's [a post](https://infosec.exchange/@cybersoldier/109539417115275975) in which I shared the idea on Mastodon. After spending some days learning basics of ElectronJS, I am excited to announce the first release of DVEA, a "Damn Vulnerable Electron App" that I have developed for educational purposes. DVEA is an open-source app that is intentionally built with vulnerabilities to help educate developers about the types of security vulnerabilities that can occur in Electron apps and how to prevent them.

### Challenges faced

This was my first time developing a complete ElectronJS app so the learning curve was steep in the beginning, it was hard to decide the nature of app that I can build on, more vulnerabilities could have been added in a social media platform or a E-commerce app but it would have taken equally more time so I decided to go with basic to-do list and introduce the most common vulnerabilities in it, you can follow [this writeup](https://infosecwriteups.com/remote-code-execution-through-cross-site-scripting-in-electron-f3b891ad637) to exploit the vulnerabilities in the app. I am open for suggestions and feedback to improve the app.

### Get DVEA
DVEA is available on [GitHub](https://github.com/njmulsqb/DVEA) and binaries can be downloaded from the [releases page](https://github.com/njmulsqb/DVEA/releases/latest).

### I need your help!
Please note that DVEA is still in the initial stages of development and I welcome feedback to help improve and expand the app to include more platform-specific vulnerabilities. DVEA is also open for PRs and contributions in anyway one is willing to contribute. DVEA is not intended for use in production environments and should only be used in a controlled environment for educational purposes.

I hope that DVEA will be a valuable resource for developers and security engineers looking to learn more about secure coding practices and the importance of protecting against vulnerabilities in Electron apps by getting their hands dirty in a vulnerable lab.
