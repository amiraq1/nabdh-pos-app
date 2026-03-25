package com.nabdh.pos;

import android.Manifest;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothSocket;
import android.os.Build;
import android.util.Base64;

import androidx.annotation.Nullable;

import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

import java.io.IOException;
import java.io.OutputStream;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

@CapacitorPlugin(
    name = "BluetoothPrinter",
    permissions = {
        @Permission(alias = "bluetooth", strings = { Manifest.permission.BLUETOOTH_CONNECT })
    }
)
public class BluetoothPrinterPlugin extends Plugin {

    private static final UUID SPP_UUID = UUID.fromString("00001101-0000-1000-8000-00805f9b34fb");

    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    private BluetoothAdapter bluetoothAdapter;
    private BluetoothSocket bluetoothSocket;
    private OutputStream outputStream;
    private BluetoothDevice connectedDevice;

    @Override
    public void load() {
        bluetoothAdapter = BluetoothAdapter.getDefaultAdapter();
    }

    @Override
    protected void handleOnDestroy() {
        disconnectInternal();
        executor.shutdownNow();
        super.handleOnDestroy();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject result = new JSObject();
        boolean available = bluetoothAdapter != null;
        boolean enabled = available && bluetoothAdapter.isEnabled();
        boolean connected = isConnected();

        result.put("available", available);
        result.put("enabled", enabled);
        result.put("connected", connected);

        if (connectedDevice != null && hasBluetoothPermission()) {
          result.put("name", safeDeviceName(connectedDevice));
          result.put("address", connectedDevice.getAddress());
        }

        call.resolve(result);
    }

    @PluginMethod
    public void listPairedDevices(PluginCall call) {
        if (!ensureAdapterReady(call) || !ensureBluetoothPermission(call)) {
            return;
        }

        Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();
        JSArray devices = new JSArray();

        for (BluetoothDevice device : bondedDevices) {
            JSObject entry = new JSObject();
            entry.put("name", safeDeviceName(device));
            entry.put("address", device.getAddress());
            devices.put(entry);
        }

        JSObject result = new JSObject();
        result.put("devices", devices);
        call.resolve(result);
    }

    @PluginMethod
    public void connect(PluginCall call) {
        if (!ensureAdapterReady(call) || !ensureBluetoothPermission(call)) {
            return;
        }

        final String address = call.getString("address");
        final String name = call.getString("name");

        executor.execute(() -> {
            try {
                BluetoothDevice targetDevice = resolveTargetDevice(address, name);

                if (targetDevice == null) {
                    call.reject("لم يتم العثور على الطابعة المطلوبة ضمن الأجهزة المقترنة", "printer_not_found");
                    return;
                }

                connectInternal(targetDevice);
                call.resolve(buildStatus(targetDevice, true));
            } catch (Exception exception) {
                disconnectInternal();
                call.reject(getFriendlyMessage(exception), "connection_failed", exception);
            }
        });
    }

    @PluginMethod
    public void disconnect(PluginCall call) {
        disconnectInternal();
        call.resolve();
    }

    @PluginMethod
    public void print(PluginCall call) {
        if (!ensureAdapterReady(call) || !ensureBluetoothPermission(call)) {
            return;
        }

        final String payloadBase64 = call.getString("payloadBase64");
        final String address = call.getString("address");
        final String name = call.getString("name");

        if (payloadBase64 == null || payloadBase64.isEmpty()) {
            call.reject("البيانات المرسلة للطباعة فارغة", "invalid_payload");
            return;
        }

        executor.execute(() -> {
            try {
                BluetoothDevice targetDevice = connectedDevice;

                if (address != null || name != null) {
                    targetDevice = resolveTargetDevice(address, name);
                }

                if (targetDevice == null) {
                    call.reject("لا توجد طابعة محددة أو متصلة للطباعة", "printer_not_found");
                    return;
                }

                connectInternal(targetDevice);

                if (outputStream == null) {
                    call.reject("تعذر فتح قناة الإرسال إلى الطابعة", "connection_failed");
                    return;
                }

                byte[] bytes = Base64.decode(payloadBase64, Base64.DEFAULT);
                outputStream.write(bytes);
                outputStream.flush();

                call.resolve(buildStatus(targetDevice, true));
            } catch (Exception exception) {
                disconnectInternal();
                call.reject(getFriendlyMessage(exception), "print_failed", exception);
            }
        });
    }

    private boolean ensureAdapterReady(PluginCall call) {
        if (bluetoothAdapter == null) {
            call.reject("هذا الجهاز لا يدعم البلوتوث", "unsupported");
            return false;
        }

        if (!bluetoothAdapter.isEnabled()) {
            call.reject("البلوتوث مغلق في الهاتف", "bluetooth_disabled");
            return false;
        }

        return true;
    }

    private boolean ensureBluetoothPermission(PluginCall call) {
        if (!hasBluetoothPermission()) {
            call.reject("يجب منح إذن البلوتوث للطباعة", "permission_denied");
            return false;
        }

        return true;
    }

    private boolean hasBluetoothPermission() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            return true;
        }

        return getPermissionState("bluetooth") == PermissionState.GRANTED;
    }

    private synchronized boolean isConnected() {
        return bluetoothSocket != null && bluetoothSocket.isConnected() && outputStream != null;
    }

    private synchronized void connectInternal(BluetoothDevice targetDevice) throws Exception {
        if (isConnected() && connectedDevice != null && connectedDevice.getAddress().equals(targetDevice.getAddress())) {
            return;
        }

        disconnectInternal();
        bluetoothAdapter.cancelDiscovery();

        BluetoothSocket socket = null;
        Exception lastError = null;

        try {
            socket = targetDevice.createInsecureRfcommSocketToServiceRecord(SPP_UUID);
            socket.connect();
        } catch (Exception insecureError) {
            closeQuietly(socket);
            lastError = insecureError;
            socket = null;

            try {
                socket = targetDevice.createRfcommSocketToServiceRecord(SPP_UUID);
                socket.connect();
            } catch (Exception secureError) {
                closeQuietly(socket);
                lastError = secureError;
                socket = null;

                try {
                    socket = (BluetoothSocket) targetDevice
                        .getClass()
                        .getMethod("createRfcommSocket", int.class)
                        .invoke(targetDevice, 1);
                    socket.connect();
                } catch (Exception reflectionError) {
                    closeQuietly(socket);
                    lastError = reflectionError;
                }
            }
        }

        if (socket == null || !socket.isConnected()) {
            throw lastError != null ? lastError : new IOException("تعذر فتح الاتصال بالطابعة");
        }

        bluetoothSocket = socket;
        outputStream = socket.getOutputStream();
        connectedDevice = targetDevice;
    }

    @Nullable
    private BluetoothDevice resolveTargetDevice(@Nullable String address, @Nullable String name) {
        if (bluetoothAdapter == null) {
            return null;
        }

        Set<BluetoothDevice> bondedDevices = bluetoothAdapter.getBondedDevices();

        if (address != null && !address.isEmpty()) {
            for (BluetoothDevice device : bondedDevices) {
                if (address.equalsIgnoreCase(device.getAddress())) {
                    return device;
                }
            }
        }

        if (name != null && !name.isEmpty()) {
            for (BluetoothDevice device : bondedDevices) {
                if (name.equalsIgnoreCase(safeDeviceName(device))) {
                    return device;
                }
            }
        }

        return connectedDevice;
    }

    private synchronized void disconnectInternal() {
        closeQuietly(outputStream);
        closeQuietly(bluetoothSocket);
        outputStream = null;
        bluetoothSocket = null;
        connectedDevice = null;
    }

    private JSObject buildStatus(@Nullable BluetoothDevice device, boolean connected) {
        JSObject result = new JSObject();
        result.put("available", bluetoothAdapter != null);
        result.put("enabled", bluetoothAdapter != null && bluetoothAdapter.isEnabled());
        result.put("connected", connected);

        if (device != null) {
            result.put("name", safeDeviceName(device));
            result.put("address", device.getAddress());
        }

        return result;
    }

    private String safeDeviceName(BluetoothDevice device) {
        String name = device.getName();
        return name == null || name.trim().isEmpty() ? "Bluetooth Printer" : name;
    }

    private String getFriendlyMessage(Exception exception) {
        String message = exception.getMessage();

        if (message == null || message.trim().isEmpty()) {
            return "تعذر تنفيذ عملية الطباعة عبر البلوتوث";
        }

        return message;
    }

    private void closeQuietly(@Nullable OutputStream stream) {
        if (stream == null) {
            return;
        }

        try {
            stream.close();
        } catch (IOException ignored) {
        }
    }

    private void closeQuietly(@Nullable BluetoothSocket socket) {
        if (socket == null) {
            return;
        }

        try {
            socket.close();
        } catch (IOException ignored) {
        }
    }
}
