/**
 * =========================================================================
 * GOOGLE APPS SCRIPT - BẢNG CHẤM CÔNG & KM ONLINE (ĐỒNG BỘ 2 CHIỀU THỜI GIAN THỰC)
 * 
 * Tính năng nâng cấp:
 * - 62 DÒNG (31 ngày Ca 1 + 31 ngày Ca 2 dự phòng).
 * - CỘT H (note): Giữ nguyên ghi chú.
 * - CỘT I (Ảnh Minh Chứng): Tự động lưu ảnh chụp lên Google Drive và dán đường link.
 *   + Tự động tạo thư mục theo tháng: "Ảnh chụp chấm công trần huy hoàng tháng [X]"
 *   + Tên file ảnh: "chấm công ngày [dd-MM-yyyy] giờ [HH-mm-ss]_[CheckIn/CheckOut].jpg"
 *   + Cột I nối link: "Check-in ([giờ]): [link]\nCheck-out ([giờ]): [link]"
 * - TỔNG GIỜ LÀM & TỔNG KM: Tự động cộng dồn 62 dòng tại dòng 65 & 66.
 * =========================================================================
 */

var TOTAL_ROWS = 62; // 31 ngày Ca 1 + 31 ngày Ca 2

/**
 * TỰ ĐỘNG TÍNH TOÁN KHI SỬA BẰNG TAY TRÊN GOOGLE SHEETS
 */
function onEdit(e) {
  try {
    if (!e || !e.range) return;
    var sheet = e.range.getSheet();
    var sheetName = sheet.getName();
    
    if (sheetName.indexOf("Tháng") !== -1 || sheetName.indexOf("Thang") !== -1) {
      var col = e.range.getColumn();
      if (col >= 2 && col <= 5) {
        tinhToanVaDienBang(sheet);
        var yr = 2026;
        var parts = sheetName.split(/[-/_]/);
        if (parts.length > 1) yr = parseInt(parts[parts.length - 1], 10) || 2026;
        updateAnnualSummarySheet(SpreadsheetApp.getActiveSpreadsheet(), yr);
      }
    }
  } catch (err) {
    Logger.log("Lỗi onEdit: " + err.toString());
  }
}

/**
 * XỬ LÝ GET REQUEST
 */
function doGet(e) {
  try {
    var params = (e && e.parameter) ? e.parameter : {};
    var action = params.action || 'get_data';
    var year = parseInt(params.year, 10) || new Date().getFullYear();
    var month = parseInt(params.month, 10) || (new Date().getMonth() + 1);

    if (action === 'get_annual') {
      return responseJSON(layDuLieuCaNam(year));
    }

    return responseJSON(layDuLieuThang(year, month));
  } catch (err) {
    return responseJSON({ status: 'error', error: err.toString() });
  }
}

/**
 * XỬ LÝ POST REQUEST (ĐỒNG BỘ 2 CHIỀU & LƯU ẢNH LÊN DRIVE)
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return responseJSON({ status: 'info', message: 'Hàm doPost đã sẵn sàng nhận dữ liệu từ App.' });
    }

    var contents = e.postData.contents;
    var data = JSON.parse(contents);
    var ss = SpreadsheetApp.getActiveSpreadsheet();

    // 1. Kiểm tra kết nối nhanh (Ping)
    if (data.action === 'ping') {
      return responseJSON({ status: 'ok', message: 'Kết nối Google Sheets thành công!' });
    }

    // 2. Lấy dữ liệu tháng mới nhất
    if (data.action === 'get_data') {
      var y = parseInt(data.year, 10) || new Date().getFullYear();
      var m = parseInt(data.month, 10) || (new Date().getMonth() + 1);
      return responseJSON(layDuLieuThang(y, m));
    }

    // 3. Lấy dữ liệu tổng hợp cả năm
    if (data.action === 'get_annual') {
      var yAnn = parseInt(data.year, 10) || new Date().getFullYear();
      return responseJSON(layDuLieuCaNam(yAnn));
    }

    // 4. Ghi nhận 1 lần check-in hoặc check-out từ App (CÓ KÈM ẢNH)
    if (data.action === 'record') {
      var year = parseInt(data.year, 10) || new Date().getFullYear();
      var month = parseInt(data.month, 10) || (new Date().getMonth() + 1);
      var day = parseInt(data.day, 10);
      var shift = parseInt(data.shift, 10) || 1; // 1 hoặc 2

      var sheet = getOrCreateMonthSheet(ss, year, month);
      var targetDayIndex = (shift === 2) ? (day + 31) : day;
      var rowIndex = targetDayIndex + 1;

      if (data.type === 'in') {
        sheet.getRange(rowIndex, 2).setValue(data.time);
        sheet.getRange(rowIndex, 4).setValue(data.km);
      } else if (data.type === 'out') {
        sheet.getRange(rowIndex, 3).setValue(data.time);
        sheet.getRange(rowIndex, 5).setValue(data.km);
      }

      if (data.note !== undefined && data.note !== null) {
        sheet.getRange(rowIndex, 8).setValue(data.note);
      }

      // XỬ LÝ UPLOAD ẢNH LÊN DRIVE NẾU CÓ DỮ LIỆU BASE64
      var uploadedImageUrl = "";
      if (data.imageBase64) {
        try {
          uploadedImageUrl = saveImageToDrive(data.imageBase64, {
            year: year,
            month: month,
            day: day,
            time: data.time,
            type: data.type,
            shift: shift
          });

          if (uploadedImageUrl) {
            appendImageLinkToCell(sheet, rowIndex, data.type, data.time, uploadedImageUrl, shift);
          }
        } catch (imgErr) {
          Logger.log("Lỗi upload ảnh: " + imgErr.toString());
        }
      }

      tinhToanVaDienBang(sheet);
      updateAnnualSummarySheet(ss, year);
      SpreadsheetApp.flush();

      var res = layDuLieuThang(year, month);
      res.imageUrl = uploadedImageUrl;
      return responseJSON(res);
    }

    // 5. Cập nhật sửa 1 hàng từ App
    if (data.action === 'update_row') {
      var yrU = parseInt(data.year, 10) || new Date().getFullYear();
      var moU = parseInt(data.month, 10) || (new Date().getMonth() + 1);
      var dayU = parseInt(data.day, 10);

      var shU = getOrCreateMonthSheet(ss, yrU, moU);
      var rowU = dayU + 1;

      shU.getRange(rowU, 2).setValue(data.checkIn || "");
      shU.getRange(rowU, 3).setValue(data.checkOut || "");
      shU.getRange(rowU, 4).setValue(data.kmIn !== null && data.kmIn !== undefined ? data.kmIn : "");
      shU.getRange(rowU, 5).setValue(data.kmOut !== null && data.kmOut !== undefined ? data.kmOut : "");
      if (data.note !== undefined && data.note !== null) {
        shU.getRange(rowU, 8).setValue(data.note);
      }

      tinhToanVaDienBang(shU);
      updateAnnualSummarySheet(ss, yrU);
      SpreadsheetApp.flush();

      return responseJSON(layDuLieuThang(yrU, moU));
    }

    // 6. Đồng bộ toàn bộ cả tháng từ App lên Sheet
    if (data.action === 'sync_month') {
      var yrM = parseInt(data.year, 10) || new Date().getFullYear();
      var moM = parseInt(data.month, 10) || (new Date().getMonth() + 1);
      var mData = data.data || {};

      var shM = getOrCreateMonthSheet(ss, yrM, moM);
      var valuesToSet = [];
      for (var d = 1; d <= TOTAL_ROWS; d++) {
        var rec = mData[d] || {};
        var cIn = rec.checkIn || "";
        var cOut = rec.checkOut || "";
        var kIn = (rec.kmIn !== null && rec.kmIn !== undefined && rec.kmIn !== "") ? rec.kmIn : "";
        var kOut = (rec.kmOut !== null && rec.kmOut !== undefined && rec.kmOut !== "") ? rec.kmOut : "";
        valuesToSet.push([cIn, cOut, kIn, kOut]);
      }
      shM.getRange(2, 2, TOTAL_ROWS, 4).setValues(valuesToSet);
      tinhToanVaDienBang(shM);
      updateAnnualSummarySheet(ss, yrM);
      SpreadsheetApp.flush();

      return responseJSON(layDuLieuThang(yrM, moM));
    }

    // 7. Đồng bộ hàng loạt bản ghi từ Hàng chờ Offline (Hỗ trợ kèm ảnh)
    if (data.action === 'sync_queue') {
      var items = data.items || [];
      var updatedSheets = {};
      var latestYear = new Date().getFullYear();
      var latestMonth = new Date().getMonth() + 1;

      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var yQ = parseInt(item.year, 10) || latestYear;
        var mQ = parseInt(item.month, 10) || latestMonth;
        var dQ = parseInt(item.day, 10);
        var shQ = parseInt(item.shift, 10) || 1;
        latestYear = yQ;
        latestMonth = mQ;

        var sh = getOrCreateMonthSheet(ss, yQ, mQ);
        var targetIndex = (shQ === 2 && dQ <= 31) ? (dQ + 31) : dQ;
        var r = targetIndex + 1;

        if (item.type === 'in') {
          if (item.time) sh.getRange(r, 2).setValue(item.time);
          if (item.km !== null && item.km !== undefined) sh.getRange(r, 4).setValue(item.km);
        } else if (item.type === 'out') {
          if (item.time) sh.getRange(r, 3).setValue(item.time);
          if (item.km !== null && item.km !== undefined) sh.getRange(r, 5).setValue(item.km);
        } else if (item.type === 'row') {
          sh.getRange(r, 2).setValue(item.checkIn || "");
          sh.getRange(r, 3).setValue(item.checkOut || "");
          sh.getRange(r, 4).setValue(item.kmIn !== null && item.kmIn !== undefined ? item.kmIn : "");
          sh.getRange(r, 5).setValue(item.kmOut !== null && item.kmOut !== undefined ? item.kmOut : "");
          if (item.note !== undefined && item.note !== null) {
            sh.getRange(r, 8).setValue(item.note);
          }
        }

        if (item.imageBase64) {
          try {
            var urlOffline = saveImageToDrive(item.imageBase64, {
              year: yQ,
              month: mQ,
              day: dQ,
              time: item.time,
              type: item.type,
              shift: shQ
            });
            if (urlOffline) {
              appendImageLinkToCell(sh, r, item.type, item.time, urlOffline, shQ);
            }
          } catch(e) {}
        }

        updatedSheets[sh.getName()] = { sheet: sh, year: yQ };
      }

      for (var key in updatedSheets) {
        tinhToanVaDienBang(updatedSheets[key].sheet);
        updateAnnualSummarySheet(ss, updatedSheets[key].year);
      }
      SpreadsheetApp.flush();

      var freshData = layDuLieuThang(latestYear, latestMonth);
      freshData.syncedCount = items.length;
      return responseJSON(freshData);
    }

    return responseJSON({ status: 'unknown_action' });
  } catch (err) {
    return responseJSON({ status: 'error', error: err.toString() });
  }
}

/**
 * TẠO HOẶC LẤY THƯ MỤC DRIVE THEO THÁNG: "Ảnh chụp chấm công trần huy hoàng tháng [X]"
 */
function getOrCreateDriveMonthFolder(month) {
  var folderName = "Ảnh chụp chấm công trần huy hoàng tháng " + month;
  var folders = DriveApp.getFoldersByName(folderName);
  if (folders.hasNext()) {
    return folders.next();
  }
  return DriveApp.createFolder(folderName);
}

/**
 * LƯU ẢNH LÊN GOOGLE DRIVE VÀ TRẢ VỀ ĐƯỜNG LINK XEM TRỰC TIẾP
 */
function saveImageToDrive(base64Data, info) {
  var folder = getOrCreateDriveMonthFolder(info.month);
  
  // Xử lý chuỗi Base64
  var cleanBase64 = base64Data;
  if (cleanBase64.indexOf(",") !== -1) {
    cleanBase64 = cleanBase64.split(",")[1];
  }
  var decoded = Utilities.base64Decode(cleanBase64);
  var blob = Utilities.newBlob(decoded, "image/jpeg");

  var dStr = (info.day < 10 ? "0" + info.day : "" + info.day);
  var mStr = (info.month < 10 ? "0" + info.month : "" + info.month);
  var timeClean = String(info.time || "00-00-00").replace(/:/g, "h");
  var typeStr = (info.type === 'in' ? 'CheckIn' : 'CheckOut');
  var shiftStr = (info.shift === 2 ? '_Ca2' : '');

  // Tên file: "chấm công ngày 08-11-2026 giờ 14h30_CheckIn.jpg"
  var fileName = "chấm công ngày " + dStr + "-" + mStr + "-" + info.year + " giờ " + timeClean + "_" + typeStr + shiftStr + ".jpg";
  blob.setName(fileName);

  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return file.getUrl();
}

/**
 * NỐI LINK ẢNH VÀO CỘT I CỦA DÒNG TƯƠNG ỨNG
 */
function appendImageLinkToCell(sheet, row, type, time, url, shift) {
  var cell = sheet.getRange(row, 9);
  var currentText = cell.getValue() ? String(cell.getValue()).trim() : "";
  var tag = (type === 'in' ? 'Check-in' : 'Check-out');
  var newEntry = tag + " (" + time + "): " + url;

  if (currentText === "") {
    cell.setValue(newEntry);
  } else if (currentText.indexOf(url) === -1) {
    cell.setValue(currentText + "\n" + newEntry);
  }
}

/**
 * TÌM SHEET THÁNG THÔNG MINH
 */
function findMonthSheet(ss, year, month) {
  var m2 = (month < 10 ? "0" + month : "" + month);
  var m1 = "" + month;
  var candidates = [
    "Tháng " + m2 + "-" + year,
    "Tháng " + m1 + "-" + year,
    "Tháng " + m2 + "/" + year,
    "Tháng " + m1 + "/" + year,
    "Tháng " + m2,
    "Tháng " + m1,
    "Thang " + m2 + "-" + year,
    "Thang " + m1 + "-" + year,
    "Thang " + m2,
    "Thang " + m1
  ];

  for (var i = 0; i < candidates.length; i++) {
    var sh = ss.getSheetByName(candidates[i]);
    if (sh) return sh;
  }

  var allSheets = ss.getSheets();
  for (var j = 0; j < allSheets.length; j++) {
    var name = allSheets[j].getName().trim();
    if (name.indexOf("Tổng Hợp") === -1 && name.indexOf("Tong Hop") === -1) {
      if (name.indexOf(m1) !== -1 || name.indexOf(m2) !== -1) {
        return allSheets[j];
      }
    }
  }

  for (var k = 0; k < allSheets.length; k++) {
    var sName = allSheets[k].getName().trim();
    if (sName.indexOf("Tổng Hợp") === -1 && sName.indexOf("Tong Hop") === -1) {
      return allSheets[k];
    }
  }
  return null;
}

/**
 * ĐỌC TOÀN BỘ 62 DÒNG TỪ SHEET ĐỂ GỬI CHO APP (BAO GỒM NOTE & LINK ẢNH)
 */
function layDuLieuThang(year, month) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = findMonthSheet(ss, year, month);

  if (!sheet) {
    return { status: 'success', year: year, month: month, data: {}, exists: false };
  }

  var displayValues = sheet.getRange(2, 1, TOTAL_ROWS, 9).getDisplayValues();
  var monthData = {};

  for (var i = 0; i < TOTAL_ROWS; i++) {
    var dayIndex = i + 1;
    var row = displayValues[i];
    var customLabel = row[0] ? row[0].trim() : "";
    var cIn = row[1] ? row[1].trim() : "";
    var cOut = row[2] ? row[2].trim() : "";
    var kIn = row[3] ? row[3].trim() : "";
    var kOut = row[4] ? row[4].trim() : "";
    var noteVal = row[7] ? row[7].trim() : "";
    var photoLink = row[8] ? row[8].trim() : "";

    var kmInNum = null;
    var kmOutNum = null;

    if (kIn !== "") {
      var n1 = parseFloat(kIn.replace(/\./g, '').replace(/,/g, ''));
      if (!isNaN(n1)) kmInNum = n1;
    }
    if (kOut !== "") {
      var n2 = parseFloat(kOut.replace(/\./g, '').replace(/,/g, ''));
      if (!isNaN(n2)) kmOutNum = n2;
    }

    if (cIn || cOut || kmInNum !== null || kmOutNum !== null || noteVal || photoLink || (dayIndex > 31 && customLabel)) {
      monthData[dayIndex] = {
        label: customLabel,
        checkIn: cIn,
        checkOut: cOut,
        kmIn: kmInNum,
        kmOut: kmOutNum,
        note: noteVal,
        photoLink: photoLink
      };
    }
  }

  return {
    status: 'success',
    year: year,
    month: month,
    data: monthData,
    updatedAt: new Date().getTime(),
    exists: true
  };
}

/**
 * ĐỌC DỮ LIỆU TỔNG HỢP CẢ NĂM ĐỂ GỬI CHO TAB 3 TRÊN APP
 */
function layDuLieuCaNam(year) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var summarySheetName = "Tổng Hợp Năm " + year;
  var sheet = ss.getSheetByName(summarySheetName);
  if (!sheet) {
    updateAnnualSummarySheet(ss, year);
    sheet = ss.getSheetByName(summarySheetName);
  }
  var data = [];
  if (sheet) {
    var vals = sheet.getRange(3, 1, 12, 4).getDisplayValues();
    for (var i = 0; i < 12; i++) {
      data.push({
        month: i + 1,
        status: vals[i][1],
        hours: vals[i][2],
        km: vals[i][3]
      });
    }
  }
  return { status: 'success', year: year, annualData: data };
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * HÀM TÍNH TOÁN GIỜ LÀM, KM VÀ TỔNG CỘNG CHO 1 SHEET THÁNG (62 DÒNG)
 */
function tinhToanVaDienBang(sheet) {
  var dataRange = sheet.getRange(2, 2, TOTAL_ROWS, 4).getValues();

  var hoursCol = [];
  var kmCol = [];
  var totalSec = 0;
  var totalKm = 0;

  for (var i = 0; i < TOTAL_ROWS; i++) {
    var checkIn = dataRange[i][0];
    var checkOut = dataRange[i][1];
    var kmIn = dataRange[i][2];
    var kmOut = dataRange[i][3];

    var durStr = "";
    if (checkIn && checkOut) {
      var sec = parseTimeToSeconds(checkIn, checkOut);
      if (sec >= 0) {
        totalSec += sec;
        var h = Math.floor(sec / 3600);
        var m = Math.floor((sec % 3600) / 60);
        var s = sec % 60;
        durStr = (h < 10 ? "0" + h : h) + ":" + (m < 10 ? "0" + m : m) + ":" + (s < 10 ? "0" + s : s);
      }
    }
    hoursCol.push([durStr]);

    var kmDiff = "";
    var numIn = parseFloat(String(kmIn).replace(/\./g, '').replace(/,/g, ''));
    var numOut = parseFloat(String(kmOut).replace(/\./g, '').replace(/,/g, ''));

    if (!isNaN(numIn) && !isNaN(numOut) && numOut >= numIn) {
      var diff = numOut - numIn;
      totalKm += diff;
      kmDiff = diff;
    } else if (checkIn || checkOut) {
      kmDiff = 0;
    }
    kmCol.push([kmDiff]);
  }

  sheet.getRange(2, 6, TOTAL_ROWS, 1).setNumberFormat("@").setValues(hoursCol)
       .setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#0284c7");
  sheet.getRange(2, 7, TOTAL_ROWS, 1).setNumberFormat("#,##0").setValues(kmCol)
       .setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#16a34a");

  // Dời vị trí bảng tổng xuống dưới 62 dòng (Dòng 65 & 66)
  var sumRow1 = TOTAL_ROWS + 3; // 65
  var sumRow2 = TOTAL_ROWS + 4; // 66

  sheet.getRange(sumRow1, 6).setValue("Tổng giờ làm").setFontWeight("bold").setHorizontalAlignment("center").setBackground("#f1f5f9");
  sheet.getRange(sumRow1, 7).setValue("Tổng Km đi").setFontWeight("bold").setHorizontalAlignment("center").setBackground("#f1f5f9");

  var totH = Math.floor(totalSec / 3600);
  var totM = Math.floor((totalSec % 3600) / 60);
  var totS = totalSec % 60;
  var totalDurStr = (totH < 10 ? "0" + totH : totH) + ":" + (totM < 10 ? "0" + totM : totM) + ":" + (totS < 10 ? "0" + totS : totS);

  sheet.getRange(sumRow2, 6).setNumberFormat("@").setValue(totalDurStr)
       .setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#2563eb").setFontSize(11);
  sheet.getRange(sumRow2, 7).setNumberFormat("#,##0").setValue(totalKm)
       .setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#16a34a").setFontSize(11);

  sheet.getRange(1, 1, TOTAL_ROWS + 1, 9).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
  sheet.getRange(sumRow1, 6, 2, 2).setBorder(true, true, true, true, true, true, "#94a3b8", SpreadsheetApp.BorderStyle.SOLID);
}

function parseTimeToSeconds(timeIn, timeOut) {
  var t1 = String(timeIn).trim();
  var t2 = String(timeOut).trim();

  if (timeIn instanceof Date) {
    var h1 = timeIn.getHours();
    var m1 = timeIn.getMinutes();
    var s1 = timeIn.getSeconds();
    t1 = (h1 < 10 ? "0" + h1 : h1) + ":" + (m1 < 10 ? "0" + m1 : m1) + ":" + (s1 < 10 ? "0" + s1 : s1);
  }
  if (timeOut instanceof Date) {
    var h2 = timeOut.getHours();
    var m2 = timeOut.getMinutes();
    var s2 = timeOut.getSeconds();
    t2 = (h2 < 10 ? "0" + h2 : h2) + ":" + (m2 < 10 ? "0" + m2 : m2) + ":" + (s2 < 10 ? "0" + s2 : s2);
  }

  var p1 = t1.split(":").map(Number);
  var p2 = t2.split(":").map(Number);
  if (p1.length < 2 || p2.length < 2) return -1;

  var s1 = (p1[0] || 0) * 3600 + (p1[1] || 0) * 60 + (p1[2] || 0);
  var s2 = (p2[0] || 0) * 3600 + (p2[1] || 0) * 60 + (p2[2] || 0);

  var diff = s2 - s1;
  if (diff < 0) diff += 24 * 3600;
  return diff;
}

function updateAnnualSummarySheet(ss, year) {
  var summarySheetName = "Tổng Hợp Năm " + year;
  var sheet = ss.getSheetByName(summarySheetName);
  if (!sheet) {
    sheet = ss.insertSheet(summarySheetName, 0);
  }
  sheet.clear();
  sheet.getRange(1, 1, 1, 4).merge().setValue("BẢNG TỔNG HỢP CHẤM CÔNG VÀ KM CẢ NĂM " + year).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#0f172a").setFontColor("#38bdf8");

  var headers = [["Tháng", "Trạng thái", "Tổng Giờ Làm", "Tổng Km Đi"]];
  sheet.getRange(2, 1, 1, 4).setValues(headers).setBackground("#1e293b").setFontColor("#f8fafc").setFontWeight("bold").setHorizontalAlignment("center");

  var rows = [];
  var totalYearSec = 0;
  var totalYearKm = 0;

  for (var m = 1; m <= 12; m++) {
    var targetSheet = findMonthSheet(ss, year, m);
    var monthStr = m < 10 ? "0" + m : "" + m;
    var label = "Tháng " + monthStr + "/" + year;
    var status = targetSheet ? "Đã có dữ liệu" : "Chưa có";
    var durStr = "00:00:00";
    var kmVal = 0;

    if (targetSheet) {
      var sumRow2 = TOTAL_ROWS + 4; // 66
      var hDisplay = targetSheet.getRange(sumRow2, 6).getDisplayValue();
      var kVal = targetSheet.getRange(sumRow2, 7).getValue();

      if (hDisplay && hDisplay.indexOf(":") !== -1) {
        durStr = hDisplay.trim();
        var parts = durStr.split(":");
        var h = parseInt(parts[0], 10) || 0;
        var mi = parseInt(parts[1], 10) || 0;
        var se = parseInt(parts[2], 10) || 0;
        totalYearSec += (h * 3600 + mi * 60 + se);
      }
      if (kVal) {
        kmVal = parseFloat(kVal) || 0;
        totalYearKm += kmVal;
      }
    }

    rows.push([label, status, durStr, kmVal]);
  }

  sheet.getRange(3, 1, 12, 4).setValues(rows);
  sheet.getRange(3, 1, 12, 2).setHorizontalAlignment("center");
  sheet.getRange(3, 3, 12, 1).setNumberFormat("@").setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#0284c7");
  sheet.getRange(3, 4, 12, 1).setNumberFormat("#,##0").setHorizontalAlignment("center").setFontWeight("bold").setFontColor("#16a34a");

  var yH = Math.floor(totalYearSec / 3600);
  var yM = Math.floor((totalYearSec % 3600) / 60);
  var yS = totalYearSec % 60;
  var yearHoursStr = (yH < 10 ? "0" + yH : yH) + ":" + (yM < 10 ? "0" + yM : yM) + ":" + (yS < 10 ? "0" + yS : yS);

  sheet.getRange(16, 1, 1, 2).merge().setValue("TỔNG CẢ NĂM " + year).setFontWeight("bold").setHorizontalAlignment("center").setBackground("#e2e8f0");
  sheet.getRange(16, 3).setNumberFormat("@").setValue(yearHoursStr).setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#2563eb").setBackground("#e2e8f0");
  sheet.getRange(16, 4).setNumberFormat("#,##0").setValue(totalYearKm).setFontWeight("bold").setHorizontalAlignment("center").setFontColor("#16a34a").setBackground("#e2e8f0");

  sheet.getRange(2, 1, 15, 4).setBorder(true, true, true, true, true, true, "#cbd5e1", SpreadsheetApp.BorderStyle.SOLID);
  sheet.setColumnWidth(1, 140);
  sheet.setColumnWidth(2, 120);
  sheet.setColumnWidth(3, 150);
  sheet.setColumnWidth(4, 130);
}

function getOrCreateMonthSheet(ss, year, month) {
  var sheet = findMonthSheet(ss, year, month);
  if (!sheet) {
    var sheetName = "Tháng " + (month < 10 ? "0" + month : month) + "-" + year;
    sheet = ss.insertSheet(sheetName);
    khoiTaoKhungSheet(sheet, year, month);
  }
  return sheet;
}

/**
 * KHỞI TẠO BẢNG CHUẨN 62 DÒNG + NOTE + LINK ẢNH (CỘT I)
 */
function khoiTaoKhungSheet(sheet, year, month) {
  sheet.clear();
  var headers = [["Ngày", "Check in", "Check out", "Km in", "Km out", "Giờ làm", "Km đi được", "note", "Link Ảnh"]];
  sheet.getRange(1, 1, 1, 9).setValues(headers);
  sheet.getRange(1, 1, 1, 9).setBackground("#1e293b").setFontColor("#f8fafc").setFontWeight("bold").setHorizontalAlignment("center");

  var rows = [];
  for (var day = 1; day <= 31; day++) {
    rows.push([day, "", "", "", "", "", "", "", ""]);
  }
  for (var d2 = 32; d2 <= TOTAL_ROWS; d2++) {
    var baseDay = d2 - 31;
    rows.push(["Ca 2 ngày " + baseDay, "", "", "", "", "", "", "", ""]);
  }

  sheet.getRange(2, 1, TOTAL_ROWS, 9).setValues(rows);
  sheet.getRange(2, 1, 31, 1).setHorizontalAlignment("center").setFontWeight("bold");
  sheet.getRange(33, 1, 31, 1).setHorizontalAlignment("center").setFontStyle("italic").setFontColor("#0369a1");
  sheet.getRange(2, 2, TOTAL_ROWS, 2).setNumberFormat("hh:mm:ss").setHorizontalAlignment("center");
  sheet.getRange(2, 4, TOTAL_ROWS, 2).setNumberFormat("#,##0").setHorizontalAlignment("center");
  sheet.getRange(2, 8, TOTAL_ROWS, 1).setHorizontalAlignment("left");
  sheet.getRange(2, 9, TOTAL_ROWS, 1).setHorizontalAlignment("left").setWrap(true);

  sheet.setColumnWidth(1, 110);
  sheet.setColumnWidth(2, 105);
  sheet.setColumnWidth(3, 105);
  sheet.setColumnWidth(4, 95);
  sheet.setColumnWidth(5, 95);
  sheet.setColumnWidth(6, 115);
  sheet.setColumnWidth(7, 105);
  sheet.setColumnWidth(8, 200);
  sheet.setColumnWidth(9, 280);

  tinhToanVaDienBang(sheet);
}

/**
 * HÀM NÂNG CẤP SHEET HIỆN TẠI LÊN 62 DÒNG + CỘT LINK ẢNH
 */
function nangCapBang62Dong() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheets = ss.getSheets();

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var sheetName = sheet.getName();
    if (sheetName.indexOf("Tháng") === -1 && sheetName.indexOf("Thang") === -1) continue;

    sheet.getRange(1, 8).setValue("note").setBackground("#1e293b").setFontColor("#f8fafc").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.getRange(1, 9).setValue("Link Ảnh").setBackground("#1e293b").setFontColor("#f8fafc").setFontWeight("bold").setHorizontalAlignment("center");

    for (var d2 = 32; d2 <= TOTAL_ROWS; d2++) {
      var r = d2 + 1;
      var curVal = sheet.getRange(r, 1).getValue();
      if (!curVal || String(curVal).trim() === "" || curVal == d2) {
        var baseDay = d2 - 31;
        sheet.getRange(r, 1).setValue("Ca 2 ngày " + baseDay).setFontStyle("italic").setFontColor("#0369a1");
      }
    }

    sheet.setColumnWidth(8, 200);
    sheet.setColumnWidth(9, 280);
    sheet.getRange(2, 9, TOTAL_ROWS, 1).setWrap(true);
    tinhToanVaDienBang(sheet);
  }

  var yr = 2026;
  updateAnnualSummarySheet(ss, yr);
  SpreadsheetApp.flush();
  Logger.log("ĐÃ NÂNG CẤP XONG TOÀN BỘ CÁC SHEET LÊN 62 DÒNG + NOTE + LINK ẢNH!");
}
